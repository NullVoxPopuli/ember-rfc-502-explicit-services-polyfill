"use strict";

const fs = require("node:fs");
const path = require("node:path");

const POLYFILL = "ember-rfc-502-explicit-services-polyfill";
const INSTALL = `${POLYFILL}/install`;
const SERVICE = "@ember/service";
const POLYFILLED_EXPORTS = new Set(["service", "inject"]);
const OWNER_SOURCES = new Set([
  "@ember/application",
  "@ember/application/instance",
  "@ember/engine",
  "@ember/engine/instance",
  "@ember/owner",
  "@ember/test-helpers",
  "ember-qunit",
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

        let usesPolyfill = false;
        let touchesOwner = false;

        for (let statement of path.get("body")) {
          if (statement.isImportDeclaration()) {
            let source = statement.node.source.value;

            if (source === POLYFILL || source === INSTALL) usesPolyfill = true;
            if (
              statement.node.importKind !== "type" &&
              (OWNER_SOURCES.has(source) || source === SERVICE)
            ) {
              touchesOwner = true;
            }

            if (rewriteImport(statement)) usesPolyfill = true;
          } else if (statement.isExportNamedDeclaration()) {
            if (rewriteExport(statement)) usesPolyfill = true;
          }
        }

        if (touchesOwner && !usesPolyfill) {
          path.unshiftContainer("body", t.importDeclaration([], t.stringLiteral(INSTALL)));
        }
      },
    },
  };

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
