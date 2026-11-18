import { module, test } from "qunit";
import { setupTest } from "ember-qunit";
import { getOwner, setOwner } from "@ember/owner";

import { hasBinding, overrideService, service } from "#src/index.ts";

class Counter {
  count = 0;
}

class Doubled extends Counter {
  count = 2;
}

interface Clock {
  now(): number;
}

const clock = {
  name: "clock",
  create(props: object): Clock {
    return { now: () => (getOwner(props) ? 1 : 0) };
  },
};

const LegacyFactory = Object.assign(function LegacyFactory() {}, {
  create: () => ({ kind: "legacy" }),
});

const arrowFactory = Object.assign(() => undefined, {
  create: () => ({ kind: "arrow" }),
});

class Consumer {
  @service(clock) declare clock: Clock;
}

module("Unit | factories", function (hooks) {
  setupTest(hooks);

  test("an object with create() is a key", function (assert) {
    const instance = service(this.owner, clock);

    assert.strictEqual(instance.now(), 1, "create() gets the owner on props");
    assert.strictEqual(service(this.owner, clock), instance);
    assert.strictEqual(getOwner(instance), this.owner);
  });

  test("a function with a static create() is a key", function (assert) {
    assert.deepEqual(service(this.owner, LegacyFactory), { kind: "legacy" });
  });

  test("an arrow function with create() is a factory, not a thunk", function (assert) {
    assert.deepEqual(service(this.owner, arrowFactory), { kind: "arrow" });
  });

  test("the decorator accepts a factory", function (assert) {
    const consumer = new Consumer();

    setOwner(consumer, this.owner);

    assert.strictEqual(consumer.clock, service(this.owner, clock));
  });

  test("create() must return an object", function (assert) {
    const empty = { name: "empty", create: () => undefined };

    assert.throws(
      () => service(this.owner, empty as never),
      /empty\.create\(\) must return an object, and returned undefined/,
    );
  });

  test("an object without create() is not a key", function (assert) {
    assert.throws(
      () => service(this.owner, {} as never),
      /a key must be a class, or an object with a create\(\) method/,
    );
  });

  test("a factory that inherits from a factory key overrides it", function (assert) {
    const fixed = { __proto__: clock, name: "fixed", create: () => ({ now: () => 42 }) };

    overrideService(this.owner, clock, fixed);

    assert.true(hasBinding(this.owner, clock));
    assert.strictEqual(service(this.owner, clock).now(), 42);
  });

  test("an unrelated factory can override a factory key", function (assert) {
    const other = { name: "other", create: () => ({ now: () => 7 }) };

    overrideService(this.owner, clock, other);

    assert.strictEqual(service(this.owner, clock).now(), 7);
  });

  test("a class can override a factory key", function (assert) {
    class FakeClock {
      now() {
        return 8;
      }
    }

    overrideService(this.owner, clock, FakeClock);

    assert.strictEqual(service(this.owner, clock).now(), 8);
  });

  test("an unrelated factory cannot override a class key", function (assert) {
    const other = { name: "other", create: () => new Counter() };

    assert.throws(
      () => overrideService(this.owner, Counter, other),
      /other is neither \S+ nor a subclass of it/,
    );
  });

  test("a factory can override a class key when it returns an instance of the key", function (assert) {
    const factory = {
      __proto__: Counter,
      name: "doubledFactory",
      create: () => new Doubled(),
    } as unknown as typeof Counter;

    overrideService(this.owner, Counter, factory);

    assert.strictEqual(service(this.owner, Counter).count, 2);
  });

  test("a factory override of a class key must return an instance of the key", function (assert) {
    const wrong = {
      __proto__: Counter,
      name: "wrong",
      create: () => ({ count: 9 }),
    } as unknown as typeof Counter;

    overrideService(this.owner, Counter, wrong);

    assert.throws(
      () => service(this.owner, Counter),
      /wrong\.create\(\) must return an instance of \S+, because wrong overrides/,
    );
  });
});
