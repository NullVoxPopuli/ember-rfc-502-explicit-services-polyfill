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

function classKeyed(owner: object): ClassKeyedOwner {
  return owner as ClassKeyedOwner;
}

module("Unit | owner methods", function (hooks) {
  setupTest(hooks);

  test("owner.lookup accepts a class", function (assert) {
    const plain = classKeyed(this.owner).lookup(Plain);

    assert.true(plain instanceof Plain);
    assert.strictEqual(classKeyed(this.owner).lookup(Plain), plain);
  });

  test("owner.register accepts a class key and an implementation", function (assert) {
    classKeyed(this.owner).register(Plain, LoudPlain);

    assert.strictEqual(classKeyed(this.owner).lookup(Plain).greet(), "PLAIN");
  });

  test("owner.register(Key, Key) is the same as no registration", function (assert) {
    classKeyed(this.owner).register(Plain, Plain);

    assert.true(hasBinding(this.owner, Plain));
    assert.strictEqual(classKeyed(this.owner).lookup(Plain).greet(), "plain");
  });

  test("owner.unregister accepts a class", function (assert) {
    classKeyed(this.owner).register(Plain, LoudPlain);
    classKeyed(this.owner).lookup(Plain);
    classKeyed(this.owner).unregister(Plain);

    assert.false(isResolved(this.owner, Plain));
    assert.strictEqual(classKeyed(this.owner).lookup(Plain).greet(), "plain");
  });

  test("owner.hasRegistration only accepts string names", function (assert) {
    assert.throws(
      () => classKeyed(this.owner).hasRegistration(Plain),
      /hasRegistration only accepts string names/,
    );
    assert.true(classKeyed(this.owner).hasRegistration("service:feature-flags"));
  });

  test("string names still work on the owner", function (assert) {
    assert.true((this.owner.lookup("service:feature-flags") as FeatureFlags).isEnabled("explicit-di"));
  });
});
