import { module, test } from 'qunit';
import { setupTest } from 'ember-cli-app/tests/helpers';
import { getApplication, settled } from '@ember/test-helpers';
import { destroy } from '@ember/destroyable';
import EmberService from '@ember/service';
import { lookup, Service } from 'ember-rfc-502-explicit-services-polyfill';

import DatedJournal from 'ember-cli-app/domain/dated-journal';
import Journal from 'ember-cli-app/domain/journal';
import Logger from 'ember-cli-app/domain/logger';

module('Unit | Service base class', function (hooks) {
  setupTest(hooks);

  test('a field injects when the class is looked up by class key', function (assert) {
    const journal = lookup(this.owner, Journal);

    journal.write('hi');

    assert.true(journal.logger instanceof Logger);
    assert.deepEqual(lookup(this.owner, Logger).messages, ['hi']);
  });

  test('a field injects when the class is looked up by name', function (assert) {
    this.owner.register('service:journal', Journal);

    const journal = this.owner.lookup('service:journal');

    assert.true(journal.logger instanceof Logger);
    assert.strictEqual(journal.logger, lookup(this.owner, Logger));
  });

  test('the class extends the polyfill Service, not the EmberObject one', function (assert) {
    const journal = lookup(this.owner, Journal);

    assert.true(journal instanceof Service);
    assert.false(journal instanceof EmberService);
  });

  test('a subclass constructor can inject after super(owner)', function (assert) {
    const journal = lookup(this.owner, DatedJournal);

    assert.true(journal.logger instanceof Logger);
    assert.strictEqual(journal.opened, 0);
  });

  test('destructors run when the owner is destroyed, for both lookups', async function (assert) {
    const owner = getApplication().buildInstance();

    owner.register('service:journal', Journal);

    const byName = owner.lookup('service:journal');
    const byKey = lookup(owner, Journal);

    destroy(owner);
    await settled();

    assert.true(byName.closed);
    assert.true(byKey.closed);
  });
});
