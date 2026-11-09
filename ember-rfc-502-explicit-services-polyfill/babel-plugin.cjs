"use strict";

const fs = require("node:fs");
const path = require("node:path");

const POLYFILL = "ember-rfc-502-explicit-services-polyfill";
const OWNER_HELPERS = `${POLYFILL}/owner`;
const SERVICE = "@ember/service";
const POLYFILLED_EXPORTS = new Set(["service", "inject"]);
const OWNER_METHODS = new Map([
  ["lookup", "ownerLookup"],
  ["register", "ownerRegister"],
  ["unregister", "ownerUnregister"],
  ["hasRegistration", "ownerHasRegistration"],
]);

const PACKAGE_DIR = realpath(__dirname);

function realpath(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

const ownerPackageCache = new Map();

function readPackage(dir) {
  try {
    let json = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));

    return typeof json.name === "string" ? json : undefined;
  } catch {
    return undefined;
  }
}

function nearestPackage(dir) {
  if (ownerPackageCache.has(dir)) return ownerPackageCache.get(dir);

  let pkg = readPackage(dir);

  if (!pkg) {
    let parent = path.dirname(dir);

    pkg = parent === dir ? null : nearestPackage(parent);
  }

  ownerPackageCache.set(dir, pkg);

  return pkg;
}

function dependsOnPolyfill(pkg) {
  return ["dependencies", "devDependencies", "peerDependencies"].some(
    (field) => pkg[field] && POLYFILL in pkg[field],
  );
}

function shouldTransform(filename) {
  if (!filename) return true;

  let file = realpath(filename);

  if (file.startsWith(PACKAGE_DIR + path.sep)) return false;

  let pkg = nearestPackage(path.dirname(file));

  if (!pkg) return true;
  if (pkg.name === POLYFILL) return false;

  return dependsOnPolyfill(pkg);
}

function exportedName(node) {
  return node.type === "StringLiteral" ? node.value : node.name;
}

function partition(specifiers, getName) {
  let polyfilled = [];
  let rest = [];

  for (let specifier of specifiers) {
    if (POLYFILLED_EXPORTS.has(getName(specifier))) {
      polyfilled.push(specifier);
    } else {
      rest.push(specifier);
    }
  }

  return { polyfilled, rest };
}

function explicitServicesPolyfill(babel) {
  const t = babel.types;

  return {
    name: POLYFILL,
    visitor: {
      Program(path, state) {
        state.skip = !shouldTransform(state.filename);

        if (state.skip) return;

        state.program = path;
        state.helpers = new Map();

        for (let statement of path.get("body")) {
          if (statement.isImportDeclaration()) {
            rewriteImport(statement);
          } else if (statement.isExportNamedDeclaration()) {
            rewriteExport(statement);
          }
        }
      },

      CallExpression(path, state) {
        if (state.skip) return;

        let method = ownerMethod(path.node);

        if (!method) return;

        path.replaceWith(
          t.callExpression(helperFor(state, method), [
            path.node.callee.object,
            ...path.node.arguments,
          ]),
        );
      },

      OptionalCallExpression(path, state) {
        if (state.skip) return;
        if (path.node.optional || !path.node.callee.optional) return;
        if (continuesChain(path)) return;

        let method = ownerMethod(path.node);

        if (!method) return;

        let receiver = path.scope.generateUidIdentifierBasedOnNode(path.node.callee.object);

        path.scope.push({ id: receiver });
        path.replaceWith(
          t.conditionalExpression(
            t.binaryExpression(
              "==",
              t.assignmentExpression("=", t.cloneNode(receiver), path.node.callee.object),
              t.nullLiteral(),
            ),
            t.unaryExpression("void", t.numericLiteral(0)),
            t.callExpression(helperFor(state, method), [
              t.cloneNode(receiver),
              ...path.node.arguments,
            ]),
          ),
        );
      },
    },
  };

  function ownerMethod(node) {
    let callee = node.callee;

    if (callee.type !== "MemberExpression" && callee.type !== "OptionalMemberExpression") {
      return undefined;
    }
    if (callee.computed || callee.property.type !== "Identifier") return undefined;
    if (callee.object.type === "Super") return undefined;
    if (isOptionalChain(callee.object)) return undefined;

    let method = OWNER_METHODS.get(callee.property.name);

    if (!method) return undefined;

    let [first] = node.arguments;

    if (!first || first.type === "SpreadElement" || isName(first)) return undefined;

    return method;
  }

  function isOptionalChain(node) {
    return node.type === "OptionalMemberExpression" || node.type === "OptionalCallExpression";
  }

  function continuesChain(path) {
    let parent = path.parentPath;

    return (
      (parent.isOptionalMemberExpression() && parent.node.object === path.node) ||
      (parent.isOptionalCallExpression() && parent.node.callee === path.node)
    );
  }

  function isName(node) {
    if (node.type === "StringLiteral" || node.type === "TemplateLiteral") return true;

    return (
      node.type === "BinaryExpression" &&
      node.operator === "+" &&
      (isName(node.left) || isName(node.right))
    );
  }

  function helperFor(state, method) {
    let existing = state.helpers.get(method);

    if (existing) return t.cloneNode(existing);

    let local = state.program.scope.generateUidIdentifier(method);
    let [inserted] = state.program.unshiftContainer(
      "body",
      t.importDeclaration(
        [t.importSpecifier(local, t.identifier(method))],
        t.stringLiteral(OWNER_HELPERS),
      ),
    );

    state.program.scope.registerDeclaration(inserted);
    state.helpers.set(method, local);

    return t.cloneNode(local);
  }

  function rewriteImport(path) {
    let { node } = path;

    if (node.source.value !== SERVICE) return false;
    if (node.importKind === "type") return false;

    let { polyfilled, rest } = partition(node.specifiers, (specifier) =>
      specifier.type === "ImportSpecifier" && specifier.importKind !== "type"
        ? exportedName(specifier.imported)
        : undefined,
    );

    if (polyfilled.length === 0) return false;

    node.source = t.stringLiteral(POLYFILL);

    if (rest.length === 0) return true;

    node.specifiers = polyfilled;

    for (let specifier of rest) {
      path.scope.removeOwnBinding(specifier.local.name);
    }

    let [inserted] = path.insertAfter(t.importDeclaration(rest, t.stringLiteral(SERVICE)));

    path.scope.registerDeclaration(inserted);

    return true;
  }

  function rewriteExport(path) {
    let { node } = path;

    if (!node.source || node.source.value !== SERVICE) return false;
    if (node.exportKind === "type") return false;

    let { polyfilled, rest } = partition(node.specifiers, (specifier) =>
      specifier.type === "ExportSpecifier" && specifier.exportKind !== "type"
        ? exportedName(specifier.local)
        : undefined,
    );

    if (polyfilled.length === 0) return false;

    node.source = t.stringLiteral(POLYFILL);

    if (rest.length === 0) return true;

    node.specifiers = polyfilled;

    path.insertAfter(t.exportNamedDeclaration(null, rest, t.stringLiteral(SERVICE)));

    return true;
  }
}

module.exports = explicitServicesPolyfill;
module.exports.baseDir = () => PACKAGE_DIR;
