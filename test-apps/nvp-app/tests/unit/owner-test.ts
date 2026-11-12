import { module, test } from "qunit";
import { setupTest } from "ember-qunit";
import {
  hasBinding,
  isResolved,
  type Instance,
  type Key,
} from "ember-rfc-502-explicit-services-polyfill";

import type FeatureFlags from "#app/services/feature-flags.ts";

import Plain from "#app/domain/plain.ts";

class LoudPlain extends Plain {
  greet() {
    return "PLAIN";
  }
}

interface ClassKeyedOwner {
  lookup<K extends Key>(key: K): Instance<K>;
  register(key: Key, implementation: Key): void;
  unregister(key: Key): void;
  hasRegistration(key: Key | string): boolean;
}

module("Unit | owner methods", function (hooks) {
  setupTest(hooks);

  test("owner.lookup accepts a class", function (assert) {
    const plain = (this.owner as unknown as ClassKeyedOwner).lookup(Plain);

    assert.true(plain instanceof Plain);
    assert.strictEqual(
      (this.owner as unknown as ClassKeyedOwner).lookup(Plain),
      plain,
    );
  });

  test("owner.register accepts a class key and an implementation", function (assert) {
    (this.owner as unknown as ClassKeyedOwner).register(Plain, LoudPlain);

    assert.strictEqual(
      (this.owner as unknown as ClassKeyedOwner).lookup(Plain).greet(),
      "PLAIN",
    );
  });

  test("owner.register(Key, Key) is the same as no registration", function (assert) {
    (this.owner as unknown as ClassKeyedOwner).register(Plain, Plain);

    assert.true(hasBinding(this.owner, Plain));
    assert.strictEqual(
      (this.owner as unknown as ClassKeyedOwner).lookup(Plain).greet(),
      "plain",
    );
  });

  test("owner.unregister accepts a class", function (assert) {
    (this.owner as unknown as ClassKeyedOwner).register(Plain, LoudPlain);
    (this.owner as unknown as ClassKeyedOwner).lookup(Plain);
    (this.owner as unknown as ClassKeyedOwner).unregister(Plain);

    assert.false(isResolved(this.owner, Plain));
    assert.strictEqual(
      (this.owner as unknown as ClassKeyedOwner).lookup(Plain).greet(),
      "plain",
    );
  });

  test("owner.hasRegistration only accepts string names", function (assert) {
    assert.throws(
      () => (this.owner as unknown as ClassKeyedOwner).hasRegistration(Plain),
      /hasRegistration only accepts string names/,
    );
    assert.true(
      (this.owner as unknown as ClassKeyedOwner).hasRegistration(
        "service:feature-flags",
      ),
    );
  });

  test("string names still work on the owner", function (assert) {
    assert.true(
      (this.owner.lookup("service:feature-flags") as FeatureFlags).isEnabled(
        "explicit-di",
      ),
    );
  });
});
