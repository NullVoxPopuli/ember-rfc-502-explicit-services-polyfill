import { module, test } from "qunit";
import { setupTest } from "ember-qunit";

import Plain from "#app/domain/plain.ts";

class LoudPlain extends Plain {
  greet() {
    return "PLAIN";
  }
}

interface ClassKeyedOwner {
  lookup(key: typeof Plain): Plain;
  register(key: typeof Plain, implementation: typeof Plain): void;
  unregister(key: typeof Plain): void;
}

module("Unit | owner methods in a file that does not import the polyfill", function (hooks) {
  setupTest(hooks);

  test("owner.register and owner.lookup accept a class", function (assert) {
    const owner = this.owner as unknown as ClassKeyedOwner;

    owner.register(Plain, LoudPlain);

    assert.strictEqual(owner.lookup(Plain).greet(), "PLAIN");

    owner.unregister(Plain);

    assert.strictEqual(owner.lookup(Plain).greet(), "plain");
  });
});
