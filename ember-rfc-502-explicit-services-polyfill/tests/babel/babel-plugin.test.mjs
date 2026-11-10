import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";

import { transformSync } from "@babel/core";

const require = createRequire(import.meta.url);
const plugin = require("../../babel-plugin.cjs");
const appFile = join(tmpdir(), "some-app", "app", "components", "demo.ts");

function transform(code, filename = appFile) {
  return transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    plugins: [plugin],
    parserOpts: { plugins: ["typescript", ["decorators", { decoratorsBeforeExport: true }]] },
  }).code;
}

function normalize(code) {
  return code.trim().replace(/\s+/g, " ").replaceAll("'", '"');
}

function transformsTo(input, expected, filename) {
  assert.equal(normalize(transform(input, filename)), normalize(expected));
}

function unchanged(input, filename) {
  transformsTo(input, input, filename);
}

function fixture(pkg) {
  let dir = mkdtempSync(join(tmpdir(), "rfc-502-babel-"));

  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));

  return join(dir, "src", "a.js");
}

const POLYFILL = "ember-rfc-502-explicit-services-polyfill";

test("moves service to the polyfill", () => {
  transformsTo(
    `import { service } from '@ember/service';
     class A { @service(Counter) counter; }`,
    `import { service } from '${POLYFILL}';
     class A { @service(Counter) counter; }`,
  );
});

test("moves inject, and keeps the local name it was imported as", () => {
  transformsTo(
    `import { inject as service } from '@ember/service';
     class A { @service('session') session; }`,
    `import { inject as service } from '${POLYFILL}';
     class A { @service('session') session; }`,
  );
});

test("a Service subclass that calls service(this, Key) extends the polyfill's Service", () => {
  transformsTo(
    `import Service, { service } from '@ember/service';
     class A extends Service { counter = service(this, Counter); }`,
    `import { Service, service } from '${POLYFILL}';
     class A extends Service { counter = service(this, Counter); }`,
  );
});

test("a Service subclass that injects a class key with a decorator extends the polyfill's Service", () => {
  transformsTo(
    `import Service, { service } from '@ember/service';
     class A extends Service { @service(() => Counter) counter; }`,
    `import { Service, service } from '${POLYFILL}';
     class A extends Service { @service(() => Counter) counter; }`,
  );
});

test("a Service subclass that only injects by name keeps Service from @ember/service", () => {
  transformsTo(
    `import Service, { service } from '@ember/service';
     class A extends Service { @service session; @service('store') store; init() {} }`,
    `import Service from '@ember/service';
     import { service } from '${POLYFILL}';
     class A extends Service { @service session; @service('store') store; init() {} }`,
  );
});

test("keeps the @ember/service import for the classes that are not swapped", () => {
  transformsTo(
    `import Service, { service } from '@ember/service';
     class A extends Service { counter = service(this, Counter); }
     class B extends Service { @service session; }`,
    `import Service from '@ember/service';
     import { Service as Service0, service } from '${POLYFILL}';
     class A extends Service0 { counter = service(this, Counter); }
     class B extends Service { @service session; }`,
  );
});

test("keeps the local name of the Service import", () => {
  transformsTo(
    `import Base, { service } from '@ember/service';
     class A extends Base { counter = service(this, Counter); }`,
    `import { Service as Base, service } from '${POLYFILL}';
     class A extends Base { counter = service(this, Counter); }`,
  );
});

for (let [hook, source] of [
  ["init", "init() { super.init(...arguments); }"],
  ["willDestroy", "willDestroy() {}"],
  ["willDestroy as a field", "willDestroy = () => {};"],
]) {
  test(`reports ${hook} in a class that it makes extend the polyfill's Service`, () => {
    assert.throws(
      () =>
        transform(
          `import Service, { service } from '@ember/service';
           class A extends Service { counter = service(this, Counter); ${source} }`,
        ),
      /To use the features of ember-rfc-502-explicit-services-polyfill, a service must use native classes/,
    );
  });
}

test("reports Service.extend() that injects a class key", () => {
  assert.throws(
    () =>
      transform(
        `import Service, { service } from '@ember/service';
         export default Service.extend({ counter: service(Counter) });`,
      ),
    /Use a class that extends Service instead of Service.extend\(\)/,
  );
});

test("leaves Service.extend() that injects by name alone", () => {
  transformsTo(
    `import Service, { service } from '@ember/service';
     export default Service.extend({ session: service('session') });`,
    `import Service from '@ember/service';
     import { service } from '${POLYFILL}';
     export default Service.extend({ session: service('session') });`,
  );
});

test("drops a service import that is never used", () => {
  transformsTo(`import { service } from '@ember/service';`, ``);
});

test("leaves type-only imports alone", () => {
  unchanged(`import type { Registry } from '@ember/service';`);
});

test("leaves inline type specifiers on @ember/service", () => {
  transformsTo(
    `import { type Registry, service } from '@ember/service';
     class A { @service declare s: Registry['x']; }`,
    `import { type Registry } from '@ember/service';
     import { service } from '${POLYFILL}';
     class A { @service declare s: Registry['x']; }`,
  );
});

test("leaves namespace imports alone", () => {
  unchanged(`import * as s from '@ember/service';`);
});

test("re-exports service from the polyfill, and the Service class from @ember/service", () => {
  transformsTo(
    `export { default, service } from '@ember/service';`,
    `export { service } from '${POLYFILL}';
     export { default } from '@ember/service';`,
  );
});

test("rewrites owner methods called with something other than a name", () => {
  transformsTo(
    `this.owner.register(Greeter, MockGreeter);
     appInstance.lookup(CookieStore);
     owner.unregister(Key);
     owner.hasRegistration(Key);`,
    `import { ownerRegister, ownerLookup, ownerUnregister, ownerHasRegistration } from '${POLYFILL}/owner';
     ownerRegister(this.owner, Greeter, MockGreeter);
     ownerLookup(appInstance, CookieStore);
     ownerUnregister(owner, Key);
     ownerHasRegistration(owner, Key);`,
  );
});

test("reuses an existing import of a helper", () => {
  transformsTo(
    `import { ownerLookup } from '${POLYFILL}/owner';
     owner.lookup(A);`,
    `import { ownerLookup } from '${POLYFILL}/owner';
     ownerLookup(owner, A);`,
  );
});

test("does not collide with a local binding of the same name", () => {
  transformsTo(
    `const ownerLookup = 1;
     owner.lookup(A);`,
    `import { ownerLookup as ownerLookup0 } from '${POLYFILL}/owner';
     const ownerLookup = 1;
     ownerLookup0(owner, A);`,
  );
});

test("leaves string names alone", () => {
  unchanged(
    [
      "owner.lookup('service:session');",
      "owner.lookup(`service:${name}`);",
      "owner.register('service:session', Session);",
      "owner.lookup('service:' + name);",
    ].join("\n"),
  );
});

test("rewrites identifiers, because they may hold a class", () => {
  transformsTo(
    `owner.lookup(fullName);`,
    `import { ownerLookup } from '${POLYFILL}/owner';
     ownerLookup(owner, fullName);`,
  );
});

test("passes the receiver expression as the owner", () => {
  transformsTo(
    `getOwner(this).lookup(Session);`,
    `import { ownerLookup } from '${POLYFILL}/owner';
     ownerLookup(getOwner(this), Session);`,
  );
});

test("keeps the short-circuit of an optional call", () => {
  transformsTo(
    `owner?.lookup(Session);`,
    `var _owner;
     import { ownerLookup } from '${POLYFILL}/owner';
     (_owner = owner) == null ? void 0 : ownerLookup(_owner, Session);`,
  );
});

test("leaves calls it cannot rewrite safely alone", () => {
  unchanged(
    [
      "owner.lookup(...args);",
      "owner['lookup'](Session);",
      "owner.lookup();",
      "a?.owner.lookup(Session);",
      "owner?.lookup(Session).count;",
      "class X extends Y { m() { super.lookup(Session); } }",
    ].join("\n"),
  );
});

test("does not rewrite the polyfill's own modules", () => {
  unchanged(
    `import { service } from '@ember/service';
     owner.lookup(service);`,
    join(import.meta.dirname, "..", "..", "dist", "service.js"),
  );
});

test("does rewrite files in a directory that only shares the polyfill's name", () => {
  let lookalike = join(tmpdir(), POLYFILL, "test-apps", "app", "a.js");

  assert.match(
    transform(`import { service } from '@ember/service';\nservice(this, A);`, lookalike),
    new RegExp(`from "${POLYFILL}"`),
  );
});

test("rewrites files in a package that depends on the polyfill", () => {
  let file = fixture({ name: "consumer", devDependencies: { [POLYFILL]: "*" } });

  transformsTo(
    `import { service } from '@ember/service';
     service(this, A);`,
    `import { service } from '${POLYFILL}';
     service(this, A);`,
    file,
  );
});

test("leaves packages that do not depend on the polyfill alone", () => {
  let file = fixture({ name: "unrelated", dependencies: { "ember-source": "*" } });

  unchanged(
    `import { service } from '@ember/service';
     owner.lookup(service);`,
    file,
  );
});

test("exposes baseDir for ember-cli-babel caching", () => {
  assert.equal(typeof plugin.baseDir(), "string");
});

test("other plugins see the imports it adds, as ember-auto-import needs", () => {
  let seen = [];
  let recorder = () => ({
    visitor: {
      ImportDeclaration(path) {
        seen.push(path.node.source.value);
      },
    },
  });

  transformSync(
    `import { service } from '@ember/service';
     service(this, A);
     owner.register(A, B);`,
    {
      filename: appFile,
      babelrc: false,
      configFile: false,
      plugins: [plugin, recorder],
      parserOpts: { plugins: ["typescript"] },
    },
  );

  assert.ok(seen.includes(POLYFILL), seen.join(", "));
  assert.ok(seen.includes(`${POLYFILL}/owner`), seen.join(", "));
});
