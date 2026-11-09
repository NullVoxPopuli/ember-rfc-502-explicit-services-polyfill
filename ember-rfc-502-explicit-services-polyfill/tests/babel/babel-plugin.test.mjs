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

test("moves re-exports", () => {
  same(
    trim(transform(`export { default, service } from '@ember/service';`)),
    trim(`
export { service } from 'ember-rfc-502-explicit-services-polyfill';
export { default } from '@ember/service';
`),
  );
});

test("does not rewrite the polyfill's own modules", () => {
  let code = `import { service } from '@ember/service';\nowner.lookup(Key);`;
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
  let code = `import { service } from '@ember/service';\nowner.lookup(Key);`;

  same(transform(code, file), code);
});

test("keeps an @ember/service import with nothing to move", () => {
  same(transform(`import Service from '@ember/service';`), `import Service from '@ember/service';`);
});

test("leaves namespace imports alone", () => {
  same(transform(`import * as s from '@ember/service';`), `import * as s from '@ember/service';`);
});

test("rewrites owner methods called with something other than a name", () => {
  same(
    transform(`
this.owner.register(Greeter, MockGreeter);
appInstance.lookup(CookieStore);
owner.unregister(Key);
owner.hasRegistration(Key);
`),
    `
import { _ownerHasRegistration } from "ember-rfc-502-explicit-services-polyfill/owner";
import { _ownerUnregister } from "ember-rfc-502-explicit-services-polyfill/owner";
import { _ownerLookup } from "ember-rfc-502-explicit-services-polyfill/owner";
import { _ownerRegister } from "ember-rfc-502-explicit-services-polyfill/owner";
_ownerRegister(this.owner, Greeter, MockGreeter);
_ownerLookup(appInstance, CookieStore);
_ownerUnregister(owner, Key);
_ownerHasRegistration(owner, Key);
`.replace(/\{ _(\w+) \}/g, "{ $1 as _$1 }"),
  );
});

test("imports each helper once", () => {
  let code = transform(`owner.lookup(A);\nowner.lookup(B);`);

  assert.equal(code.match(/import/g).length, 1);
  assert.match(code, /_ownerLookup\(owner, A\);\n_ownerLookup\(owner, B\);/);
});

test("leaves string names alone", () => {
  let code = [
    "owner.lookup('service:session');",
    "owner.lookup(`service:${name}`);",
    "owner.register('service:session', Session);",
    "owner.lookup('service:' + name);",
  ].join("\n");

  same(transform(code), code);
});

test("rewrites identifiers, because they may hold a class", () => {
  assert.match(transform(`owner.lookup(fullName);`), /_ownerLookup\(owner, fullName\)/);
});

test("passes the receiver expression as the owner", () => {
  assert.match(
    transform(`getOwner(this).lookup(Session);`),
    /_ownerLookup\(getOwner\(this\), Session\)/,
  );
});

test("keeps the short-circuit of an optional call", () => {
  let code = transform(`owner?.lookup(Session);`);

  assert.match(code, /\(_owner = owner\) == null \? void 0 : _ownerLookup\(_owner, Session\)/);
});

test("leaves calls it cannot rewrite safely alone", () => {
  let code = [
    "owner.lookup(...args);",
    "owner['lookup'](Session);",
    "owner.lookup();",
    "a?.owner.lookup(Session);",
    "owner?.lookup(Session).count;",
    "class X extends Y { m() { super.lookup(Session); } }",
  ].join("\n");

  same(transform(code).replace(/\s+/g, " "), code.replace(/\s+/g, " "));
});
