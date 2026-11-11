import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import {
  hasBinding,
  isResolved,
} from 'ember-rfc-502-explicit-services-polyfill';

import Plain from 'broccoli-app/domain/plain';

class LoudPlain extends Plain {
  greet() {
    return 'PLAIN';
  }
}

module('Unit | owner methods', function (hooks) {
  setupTest(hooks);

  test('owner.lookup accepts a class', function (assert) {
    const plain = this.owner.lookup(Plain);

    assert.true(plain instanceof Plain);
    assert.strictEqual(this.owner.lookup(Plain), plain);
  });

  test('owner.register accepts a class key and an implementation', function (assert) {
    this.owner.register(Plain, LoudPlain);

    assert.strictEqual(this.owner.lookup(Plain).greet(), 'PLAIN');
  });

  test('owner.register(Key, Key) is the same as no registration', function (assert) {
    this.owner.register(Plain, Plain);

    assert.true(hasBinding(this.owner, Plain));
    assert.strictEqual(this.owner.lookup(Plain).greet(), 'plain');
  });

  test('owner.unregister accepts a class', function (assert) {
    this.owner.register(Plain, LoudPlain);
    this.owner.lookup(Plain);
    this.owner.unregister(Plain);

    assert.false(isResolved(this.owner, Plain));
    assert.strictEqual(this.owner.lookup(Plain).greet(), 'plain');
  });

  test('owner.hasRegistration only accepts string names', function (assert) {
    assert.throws(
      () => this.owner.hasRegistration(Plain),
      /hasRegistration only accepts string names/,
    );
    assert.true(this.owner.hasRegistration('service:feature-flags'));
  });

  test('string names still work on the owner', function (assert) {
    assert.true(
      this.owner.lookup('service:feature-flags').isEnabled('explicit-di'),
    );
  });
});
