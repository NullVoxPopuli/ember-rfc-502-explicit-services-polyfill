import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";

import { transformSync } from "@babel/core";

const require = createRequire(import.meta.url);
const plugin = require("../../babel-plugin.cjs");
const appFile = join(tmpdir(), "some-app", "app", "components", "demo.js");

function transform(code, filename = appFile) {
  return transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    plugins: [plugin],
    parserOpts: { plugins: ["typescript", ["decorators", { decoratorsBeforeExport: true }]] },
  }).code;
}

function trim(code) {
  return code.trim().replace(/\n+/g, "\n").replaceAll("'", '"');
}

function same(actual, expected, message) {
  assert.equal(trim(actual), trim(expected), message);
}

test("moves service to the polyfill", () => {
  same(
    trim(transform(`import { service } from '@ember/service';`)),
    `import { service } from 'ember-rfc-502-explicit-services-polyfill';`,
  );
});

test("moves inject, including when aliased to service", () => {
  same(
    trim(transform(`import { inject as service } from '@ember/service';`)),
    `import { inject as service } from 'ember-rfc-502-explicit-services-polyfill';`,
  );
});

test("keeps the default Service import on @ember/service", () => {
  same(
    trim(transform(`import Service, { service } from '@ember/service';`)),
    trim(`
import { service } from 'ember-rfc-502-explicit-services-polyfill';
import Service from '@ember/service';
`),
  );
});

test("an @ember/service import with nothing to move still installs the owner patch", () => {
  same(
    trim(transform(`import Service from '@ember/service';`)),
    trim(`
import "ember-rfc-502-explicit-services-polyfill/install";
import Service from '@ember/service';
`),
  );
});

test("leaves type-only imports alone", () => {
  let code = `import type { Registry } from '@ember/service';`;

  same(trim(transform(code, appFile.replace(/\.js$/, ".ts"))), code);
});

test("leaves inline type specifiers on @ember/service", () => {
  same(
    trim(
      transform(
        `import { type Registry, service } from '@ember/service';`,
        appFile.replace(/\.js$/, ".ts"),
      ),
    ),
    trim(`
import { service } from 'ember-rfc-502-explicit-services-polyfill';
import { type Registry } from '@ember/service';
`),
  );
});

test("leaves namespace imports alone, apart from the owner patch", () => {
  same(
    trim(transform(`import * as s from '@ember/service';`)),
    trim(`
import "ember-rfc-502-explicit-services-polyfill/install";
import * as s from '@ember/service';
`),
  );
});

test("moves re-exports", () => {
  same(
    trim(transform(`export { default, service } from '@ember/service';`)),
    trim(`
export { service } from 'ember-rfc-502-explicit-services-polyfill';
export { default } from '@ember/service';
`),
  );
});

test("installs the owner patch in modules that reach the owner", () => {
  for (let source of [
    "@ember/application",
    "@ember/owner",
    "@ember/engine/instance",
    "ember-qunit",
    "@ember/test-helpers",
  ]) {
    same(
      trim(transform(`import x from '${source}';`)),
      trim(`
import "ember-rfc-502-explicit-services-polyfill/install";
import x from '${source}';
`),
      source,
    );
  }
});

test("does not install the owner patch twice", () => {
  let code = trim(`
import { service } from '@ember/service';
import { setupTest } from 'ember-qunit';
`);

  same(
    trim(transform(code)),
    trim(`
import { service } from 'ember-rfc-502-explicit-services-polyfill';
import { setupTest } from 'ember-qunit';
`),
  );
});

test("does not touch modules that never reach the owner", () => {
  let code = `import { tracked } from '@glimmer/tracking';`;

  same(trim(transform(code)), code);
});

test("does not rewrite the polyfill's own modules", () => {
  let code = `import { service } from '@ember/service';\nimport EngineInstance from '@ember/engine/instance';`;
  let ownFile = join(import.meta.dirname, "..", "..", "dist", "service.js");

  same(trim(transform(code, ownFile)), trim(code));
});

test("does rewrite files in a directory that only shares the polyfill's name", () => {
  let lookalike = join(
    tmpdir(),
    "ember-rfc-502-explicit-services-polyfill",
    "test-apps",
    "app",
    "a.js",
  );

  assert.match(
    transform(`import { service } from '@ember/service';`, lookalike),
    /from "ember-rfc-502-explicit-services-polyfill"/,
  );
});

test("exposes baseDir for ember-cli-babel caching", () => {
  assert.equal(typeof plugin.baseDir(), "string");
});

function fixture(pkg) {
  let dir = mkdtempSync(join(tmpdir(), "rfc-502-babel-"));

  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));

  return join(dir, "src", "a.js");
}

test("rewrites files in a package that depends on the polyfill", () => {
  let file = fixture({
    name: "consumer",
    devDependencies: { "ember-rfc-502-explicit-services-polyfill": "*" },
  });

  same(
    transform(`import { service } from '@ember/service';`, file),
    `import { service } from 'ember-rfc-502-explicit-services-polyfill';`,
  );
});

test("leaves packages that do not depend on the polyfill alone", () => {
  let file = fixture({ name: "unrelated", dependencies: { "ember-source": "*" } });
  let code = `import { service } from '@ember/service';\nimport { setupTest } from 'ember-qunit';`;

  same(transform(code, file), code);
});
