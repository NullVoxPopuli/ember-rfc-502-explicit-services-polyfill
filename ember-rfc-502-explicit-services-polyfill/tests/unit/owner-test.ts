import { module, test } from "qunit";
import { setupTest } from "ember-qunit";

import { isResolved } from "#src/index.ts";
import { ownerHasRegistration, ownerLookup, ownerRegister, ownerUnregister } from "#src/owner.ts";

class Counter {
  count = 0;
}

class Doubled extends Counter {
  count = 2;
}

module("Unit | owner helpers", function (hooks) {
  setupTest(hooks);

  test("a class key goes to the registry", function (assert) {
    ownerRegister(this.owner, Counter, Doubled);

    assert.true(ownerLookup(this.owner, Counter) instanceof Doubled);

    ownerUnregister(this.owner, Counter);

    assert.false(isResolved(this.owner, Counter));
  });

  test("a name goes to the owner", function (assert) {
    const value = { count: 5 };

    ownerRegister(this.owner, "util:counter", value, { instantiate: false });

    assert.strictEqual(ownerLookup(this.owner, "util:counter"), value);
    assert.true(ownerHasRegistration(this.owner, "util:counter"));
    assert.strictEqual(ownerLookup(this.owner, Counter), ownerLookup(this.owner, Counter));
  });

  test("hasRegistration throws for a class key", function (assert) {
    assert.throws(
      () => ownerHasRegistration(this.owner, Counter),
      /hasRegistration only accepts string names/,
    );
  });

  test("a receiver that is not an owner keeps its own method", function (assert) {
    const map = {
      lookup: (key: unknown) => `found ${String(key === Counter)}`,
    };

    assert.strictEqual(ownerLookup(map, Counter), "found true");
  });
});
