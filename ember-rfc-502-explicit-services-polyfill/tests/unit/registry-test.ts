import { module, test } from "qunit";
import { setupTest } from "ember-qunit";
import { destroy } from "@ember/destroyable";
import { getOwner, setOwner } from "@ember/owner";
import Service from "@ember/service";
import { settled } from "@ember/test-helpers";

import { hasBinding, isResolved, lookup, register, service, unregister } from "#src/index.ts";

class Counter {
  count = 0;
}

class Doubled extends Counter {
  count = 2;
}

class Unrelated {}

class Session extends Service {
  @service(Counter) declare counter: Counter;
}

class Consumer {
  @service(() => Counter) declare counter: Counter;
}

module("Unit | registry", function (hooks) {
  setupTest(hooks);

  test("lookup instantiates once per owner", function (assert) {
    const counter = lookup(this.owner, Counter);

    assert.true(counter instanceof Counter);
    assert.strictEqual(lookup(this.owner, Counter), counter);
    assert.strictEqual(getOwner(counter), this.owner);
    assert.true(isResolved(this.owner, Counter));
    assert.false(hasBinding(this.owner, Counter));
  });

  test("register binds a subclass", function (assert) {
    register(this.owner, Counter, Doubled);

    assert.true(hasBinding(this.owner, Counter));
    assert.strictEqual(lookup(this.owner, Counter).count, 2);
  });

  test("register rejects unrelated classes and late registrations", function (assert) {
    assert.throws(() => register(this.owner, Counter, Unrelated), /nor a subclass of it/);

    lookup(this.owner, Counter);

    assert.throws(() => register(this.owner, Counter, Doubled), /already been resolved/);
  });

  test("unregister drops the binding and the instance", function (assert) {
    register(this.owner, Counter, Doubled);
    lookup(this.owner, Counter);
    unregister(this.owner, Counter);

    assert.false(hasBinding(this.owner, Counter));
    assert.false(isResolved(this.owner, Counter));
    assert.strictEqual(lookup(this.owner, Counter).count, 0);
  });

  test("EmberObject services go through create and can inject class keys", function (assert) {
    const session = lookup(this.owner, Session);

    assert.true(session instanceof Session);
    assert.strictEqual(session.counter, lookup(this.owner, Counter));
  });

  test("the decorator resolves through the owner of the instance", function (assert) {
    const orphan = new Consumer();
    const owned = new Consumer();

    setOwner(owned, this.owner);

    assert.throws(() => orphan.counter, /it has no owner/);
    assert.strictEqual(owned.counter, lookup(this.owner, Counter));
  });

  test("owner methods accept class keys", function (assert) {
    const owner = this.owner as unknown as {
      lookup(key: unknown): unknown;
      register(key: unknown, impl: unknown): void;
    };

    owner.register(Counter, Doubled);

    assert.true(owner.lookup(Counter) instanceof Doubled);
  });

  test("instances are destroyed with the owner", async function (assert) {
    const session = lookup(this.owner, Session);

    destroy(this.owner);
    await settled();

    assert.true(session.isDestroyed);
  });
});
