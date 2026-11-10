import { module, test } from 'qunit';
import { setupTest } from 'min-supported/tests/helpers';
import { getApplication, settled } from '@ember/test-helpers';
import { destroy } from '@ember/destroyable';
import { lookup } from 'ember-rfc-502-explicit-services-polyfill';

import CookieStore from 'min-supported/domain/cookies/cookie-store';
import BrowserCookieStore from 'min-supported/domain/cookies/browser-cookie-store';
import ServerCookieStore from 'min-supported/domain/cookies/server-cookie-store';
import { initialize } from 'min-supported/instance-initializers/register-cookie-store';

module('Unit | instance-initializer | register-cookie-store', function (hooks) {
  setupTest(hooks);

  test('the booted app registered the browser implementation', function (assert) {
    assert.true(lookup(this.owner, CookieStore) instanceof BrowserCookieStore);
  });

  test('under fastboot, the server implementation is registered', async function (assert) {
    const owner = getApplication().buildInstance();

    owner.register(
      'service:fastboot',
      { isFastBoot: true },
      { instantiate: false },
    );
    initialize(owner);

    const store = lookup(owner, CookieStore);

    assert.true(store instanceof ServerCookieStore);
    assert.strictEqual(store.kind, 'server');

    destroy(owner);
    await settled();
  });
});
