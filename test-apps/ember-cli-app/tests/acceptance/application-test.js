import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-cli-app/tests/helpers';
import { visit } from '@ember/test-helpers';

import Greeter from 'ember-cli-app/domain/greeter';

module('Acceptance | class-keyed services', function (hooks) {
  setupApplicationTest(hooks);

  test('the route uses the real service', async function (assert) {
    await visit('/');

    assert.dom('[data-test-greeting]').hasText('hello from the real greeter');
  });

  test('an instance-initializer picks the implementation of an abstract key', async function (assert) {
    await visit('/');

    assert.dom('[data-test-cookies]').hasText('browser');
  });

  test('registering after visit throws', async function (assert) {
    await visit('/');

    assert.throws(
      () => this.owner.register(Greeter, class extends Greeter {}),
      /has already been resolved on this owner/,
    );
  });
});

module('Acceptance | stubbing a class-keyed service', function (hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(function () {
    class MockGreeter extends Greeter {
      greet() {
        return 'stubbed';
      }
    }

    this.owner.register(Greeter, MockGreeter);
  });

  test('the route gets the stub, with no inject step', async function (assert) {
    await visit('/');

    assert.dom('[data-test-greeting]').hasText('stubbed');
  });
});
