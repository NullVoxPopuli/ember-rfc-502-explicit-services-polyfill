import { module, test } from 'qunit';
import { setupTest } from 'ember-cli-app/tests/helpers';
import { setOwner } from '@ember/owner';
import { service } from '@ember/service';
import { isResolved, lookup } from 'ember-rfc-502-explicit-services-polyfill';

import Counter from 'ember-cli-app/domain/counter';
import FeatureFlags from 'ember-cli-app/services/feature-flags';

class Consumer {
  @service(Counter) counter;
  @service(() => Counter) viaThunk;
  @service('feature-flags') named;
  @service featureFlags;
}

class InferredName {
  @service() featureFlags;
}

class Owned {
  constructor(owner) {
    setOwner(this, owner);
  }
}

class Eager extends Owned {
  counter = service(this, Counter);
}

class WithPrivateField extends Owned {
  #counter = service(this, () => Counter);

  get count() {
    return this.#counter.count;
  }
}

class Lazy {
  get counter() {
    return service(this, Counter);
  }
}

module('Unit | service()', function (hooks) {
  setupTest(hooks);

  hooks.beforeEach(function () {
    Counter.constructed = 0;
  });

  test('@service(Key) is lazy', function (assert) {
    const consumer = new Consumer();

    setOwner(consumer, this.owner);

    assert.strictEqual(Counter.constructed, 0);
    assert.false(isResolved(this.owner, Counter));

    assert.strictEqual(consumer.counter, lookup(this.owner, Counter));
    assert.strictEqual(Counter.constructed, 1);
  });

  test('@service(() => Key) resolves the thunk on access', function (assert) {
    const consumer = new Consumer();

    setOwner(consumer, this.owner);

    assert.strictEqual(consumer.viaThunk, consumer.counter);
  });

  test('the string forms are unchanged', function (assert) {
    const consumer = new Consumer();
    const inferred = new InferredName();

    setOwner(consumer, this.owner);
    setOwner(inferred, this.owner);

    const flags = this.owner.lookup('service:feature-flags');

    assert.strictEqual(consumer.named, flags);
    assert.strictEqual(consumer.featureFlags, flags);
    assert.strictEqual(inferred.featureFlags, flags);
    assert.notStrictEqual(consumer.named, lookup(this.owner, FeatureFlags));
  });

  test('assigning to a decorated field replaces it on that instance', function (assert) {
    const consumer = new Consumer();
    const other = new Consumer();
    const stub = { count: 99 };

    setOwner(consumer, this.owner);
    setOwner(other, this.owner);

    consumer.counter = stub;

    assert.strictEqual(consumer.counter, stub);
    assert.strictEqual(other.counter, lookup(this.owner, Counter));
  });

  test('service(this, Key) resolves when it runs', function (assert) {
    const eager = new Eager(this.owner);

    assert.strictEqual(Counter.constructed, 1);
    assert.strictEqual(eager.counter, lookup(this.owner, Counter));
  });

  test('service(this, () => Key) works in a private field', function (assert) {
    const counter = lookup(this.owner, Counter);
    const instance = new WithPrivateField(this.owner);

    counter.increment();

    assert.strictEqual(instance.count, 1);
  });

  test('service(this, Key) in a getter resolves on first access', function (assert) {
    const lazy = new Lazy();

    setOwner(lazy, this.owner);

    assert.strictEqual(Counter.constructed, 0);
    assert.strictEqual(lazy.counter, lookup(this.owner, Counter));
    assert.strictEqual(lazy.counter, lazy.counter);
    assert.strictEqual(Counter.constructed, 1);
  });

  test('service(owner, Key) works with the owner itself', function (assert) {
    assert.strictEqual(
      service(this.owner, Counter),
      lookup(this.owner, Counter),
    );
  });

  test('service(undefined) explains the module cycle', function (assert) {
    assert.throws(() => service(undefined), /import cycle/);
    assert.throws(() => service(this.owner, undefined), /import cycle/);
  });
});
