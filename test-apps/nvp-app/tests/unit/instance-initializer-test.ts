import { module, test } from "qunit";
import { setupTest } from "ember-qunit";
import { getApplication, settled } from "@ember/test-helpers";
import { destroy } from "@ember/destroyable";
import { lookup } from "ember-rfc-502-explicit-services-polyfill";

import CookieStore from "#app/domain/cookies/cookie-store.ts";
import BrowserCookieStore from "#app/domain/cookies/browser-cookie-store.ts";
import ServerCookieStore from "#app/domain/cookies/server-cookie-store.ts";
import { initialize } from "#app/instance-initializers/register-cookie-store.ts";

module("Unit | instance-initializer | register-cookie-store", function (hooks) {
  setupTest(hooks);

  test("the booted app registered the browser implementation", function (assert) {
    assert.true(lookup(this.owner, CookieStore) instanceof BrowserCookieStore);
  });

  test("under fastboot, the server implementation is registered", async function (assert) {
    const owner = getApplication()!.buildInstance();

    owner.register("service:fastboot", { isFastBoot: true }, { instantiate: false });
    initialize(owner);

    const store = lookup(owner, CookieStore);

    assert.true(store instanceof ServerCookieStore);
    assert.strictEqual(store.kind, "server");

    destroy(owner);
    await settled();
  });
});
