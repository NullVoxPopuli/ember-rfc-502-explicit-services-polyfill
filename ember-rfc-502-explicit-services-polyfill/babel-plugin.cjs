"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { ImportUtil } = require("babel-import-util");

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
        if (!shouldTransform(state.filename)) return;

        let importUtil = new ImportUtil(babel, path);

        moveServiceImports(path, importUtil);

        for (let statement of path.get("body")) {
          if (statement.isExportNamedDeclaration()) rewriteExport(statement);
        }

        path.traverse(ownerCalls(importUtil));
      },
    },
  };

  function ownerCalls(importUtil) {
    return {
      CallExpression(path) {
        let method = ownerMethod(path.node);

        if (!method) return;

        let { object } = path.node.callee;
        let args = path.node.arguments;

        importUtil.replaceWith(path, (i) =>
          t.callExpression(i.import(OWNER_HELPERS, method), [object, ...args]),
        );
      },

      OptionalCallExpression(path) {
        if (path.node.optional || !path.node.callee.optional) return;
        if (continuesChain(path)) return;

        let method = ownerMethod(path.node);

        if (!method) return;

        let { object } = path.node.callee;
        let args = path.node.arguments;
        let receiver = path.scope.generateUidIdentifierBasedOnNode(object);

        path.scope.push({ id: receiver });
        importUtil.replaceWith(path, (i) =>
          t.conditionalExpression(
            t.binaryExpression(
              "==",
              t.assignmentExpression("=", t.cloneNode(receiver), object),
              t.nullLiteral(),
            ),
            t.unaryExpression("void", t.numericLiteral(0)),
            t.callExpression(i.import(OWNER_HELPERS, method), [t.cloneNode(receiver), ...args]),
          ),
        );
      },
    };
  }

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

  function moveServiceImports(program, importUtil) {
    let moves = [];

    for (let statement of program.get("body")) {
      if (!statement.isImportDeclaration()) continue;
      if (statement.node.source.value !== SERVICE || statement.node.importKind === "type") {
        continue;
      }

      for (let specifier of statement.get("specifiers")) {
        if (!specifier.isImportSpecifier() || specifier.node.importKind === "type") continue;

        let name = exportedName(specifier.node.imported);

        if (!POLYFILLED_EXPORTS.has(name)) continue;

        let local = specifier.node.local.name;
        let references = program.scope.getBinding(local)?.referencePaths ?? [];

        moves.push({ name, local, references });
      }
    }

    for (let { name } of moves) importUtil.removeImport(SERVICE, name);

    for (let { name, local, references } of moves) {
      for (let reference of references) {
        importUtil.replaceWith(reference, (i) => i.import(POLYFILL, name, local));
      }
    }
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
