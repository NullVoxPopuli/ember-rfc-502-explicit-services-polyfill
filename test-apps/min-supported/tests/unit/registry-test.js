import { module, test } from 'qunit';
import { setupTest } from 'min-supported/tests/helpers';
import { getApplication, settled } from '@ember/test-helpers';
import { destroy, isDestroyed } from '@ember/destroyable';
import { getOwner } from '@ember/owner';
import {
  hasBinding,
  isResolved,
  lookup,
  register,
  unregister,
} from 'ember-rfc-502-explicit-services-polyfill';

import Audit from 'min-supported/domain/audit';
import Broken from 'min-supported/domain/broken';
import Counter from 'min-supported/domain/counter';
import Logger from 'min-supported/domain/logger';
import Session from 'min-supported/domain/session';
import FeatureFlags from 'min-supported/services/feature-flags';

class SubCounter extends Counter {
  increment = () => (this.count += 2);
}

class Unrelated {}

function LegacyKey() {}
LegacyKey.prototype.kind = function () {
  return 'legacy';
};

function secondOwner() {
  return getApplication().buildInstance();
}

module('Unit | registry', function (hooks) {
  setupTest(hooks);

  test('an unregistered key registers itself on first lookup', function (assert) {
    assert.false(hasBinding(this.owner, Counter));
    assert.false(isResolved(this.owner, Counter));

    assert.true(lookup(this.owner, Counter) instanceof Counter);
    assert.true(isResolved(this.owner, Counter));
    assert.false(hasBinding(this.owner, Counter));
  });

  test('one instance per owner', function (assert) {
    assert.strictEqual(
      lookup(this.owner, Counter),
      lookup(this.owner, Counter),
    );
  });

  test('each owner gets its own instance', async function (assert) {
    const other = secondOwner();

    assert.notStrictEqual(lookup(this.owner, Counter), lookup(other, Counter));

    destroy(other);
    await settled();
  });

  test('registering a subclass replaces the implementation', function (assert) {
    register(this.owner, Counter, SubCounter);

    const counter = lookup(this.owner, Counter);

    assert.true(counter instanceof SubCounter);
    assert.true(counter instanceof Counter);
    assert.true(hasBinding(this.owner, Counter));

    counter.increment();

    assert.strictEqual(counter.count, 2);
  });

  test('registering an unrelated class throws', function (assert) {
    assert.throws(
      () => register(this.owner, Counter, Unrelated),
      /is neither \w+ nor a subclass of it/,
    );
  });

  test('registering after the key was resolved throws', function (assert) {
    lookup(this.owner, Counter);

    assert.throws(
      () => register(this.owner, Counter, SubCounter),
      /has already been resolved on this owner/,
    );
  });

  test('unregister forgets the binding and the instance', function (assert) {
    register(this.owner, Counter, SubCounter);

    const first = lookup(this.owner, Counter);

    unregister(this.owner, Counter);

    assert.false(hasBinding(this.owner, Counter));
    assert.false(isResolved(this.owner, Counter));

    const second = lookup(this.owner, Counter);

    assert.notStrictEqual(second, first);
    assert.false(second instanceof SubCounter);
  });

  test('a plain class is constructed with new and the owner', function (assert) {
    const audit = lookup(this.owner, Audit);

    assert.strictEqual(getOwner(audit), this.owner);

    audit.record('hello');

    assert.deepEqual(lookup(this.owner, Logger).messages, ['hello at 0']);
  });

  test('an EmberObject service is created through create, and its injections work', function (assert) {
    const session = lookup(this.owner, Session);

    assert.true(session instanceof Session);
    assert.strictEqual(getOwner(session), this.owner);
    assert.strictEqual(session.counter, lookup(this.owner, Counter));
    assert.true(session.flags.isEnabled('explicit-di'));
  });

  test('a class key does not fall back to the resolver name', function (assert) {
    const byClass = lookup(this.owner, FeatureFlags);
    const byName = this.owner.lookup('service:feature-flags');

    assert.true(byClass instanceof FeatureFlags);
    assert.true(byName instanceof FeatureFlags);
    assert.notStrictEqual(byClass, byName);
  });

  test('a constructor function works as a key', function (assert) {
    const legacy = lookup(this.owner, LegacyKey);

    assert.true(legacy instanceof LegacyKey);
    assert.strictEqual(legacy.kind(), 'legacy');
  });

  test('a plain class cannot inject from a field initializer', function (assert) {
    assert.throws(
      () => lookup(this.owner, Broken),
      /Cannot resolve \w+ from \w+: it has no owner/,
    );
  });

  test('a plain class needs no owner when it is not injected', function (assert) {
    const counter = new Counter();

    counter.increment();

    assert.strictEqual(counter.count, 1);
  });

  test('instances are destroyed with their owner', async function (assert) {
    const other = secondOwner();
    const counter = lookup(other, Counter);
    const session = lookup(other, Session);

    assert.false(counter.destroyed);

    destroy(other);
    await settled();

    assert.true(counter.destroyed);
    assert.true(isDestroyed(session));
  });

  test('looking up on a destroyed owner throws', async function (assert) {
    const other = secondOwner();

    destroy(other);
    await settled();

    assert.throws(
      () => lookup(other, Counter),
      /on an owner that is destroyed/,
    );
  });
});
