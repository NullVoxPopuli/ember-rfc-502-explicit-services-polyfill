import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-cli-app/tests/helpers';
import { click, render } from '@ember/test-helpers';
import { lookup } from 'ember-rfc-502-explicit-services-polyfill';

import CounterDisplay from 'ember-cli-app/components/counter-display';
import Dashboard from 'ember-cli-app/components/dashboard';
import Counter from 'ember-cli-app/domain/counter';
import Logger from 'ember-cli-app/domain/logger';

class StartsAtTen extends Counter {
  count = 10;
}

module('Integration | class-keyed services', function (hooks) {
  setupRenderingTest(hooks);

  test('a component uses a class-keyed service through the decorator and a private field', async function (assert) {
    await render(<template><CounterDisplay /></template>);

    assert.dom('output').hasText('0');

    await click('button');

    assert.dom('output').hasText('1');
    assert.deepEqual(lookup(this.owner, Logger).messages, ['increment at 1']);
  });

  test('a stub defined in the test file replaces the service', async function (assert) {
    this.owner.register(Counter, StartsAtTen);

    await render(<template><CounterDisplay /></template>);

    assert.dom('output').hasText('10');
  });

  test('string and class keys live side by side', async function (assert) {
    await render(<template><Dashboard /><CounterDisplay /></template>);

    assert.dom('[data-test-flags]').hasText('on');
    assert.dom('[data-test-count]').hasText('0');

    await click('button');

    assert.dom('[data-test-count]').hasText('1');
  });

  test('registering after render throws', async function (assert) {
    await render(<template><CounterDisplay /></template>);

    assert.throws(
      () => this.owner.register(Counter, StartsAtTen),
      /has already been resolved on this owner/,
    );
  });
});
