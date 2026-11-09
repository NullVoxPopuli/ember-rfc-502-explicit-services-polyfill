import { module, test } from "qunit";
import { setupApplicationTest } from "ember-qunit";
import { visit } from "@ember/test-helpers";
import { register } from "ember-rfc-502-explicit-services-polyfill";

import Greeter from "#app/domain/greeter.ts";

module("Acceptance | class-keyed services", function (hooks) {
  setupApplicationTest(hooks);

  test("the route uses the real service", async function (assert) {
    await visit("/");

    assert.dom("[data-test-greeting]").hasText("hello from the real greeter");
  });

  test("an instance-initializer picks the implementation of an abstract key", async function (assert) {
    await visit("/");

    assert.dom("[data-test-cookies]").hasText("browser");
  });

  test("registering after visit throws", async function (assert) {
    await visit("/");

    assert.throws(
      () => register(this.owner, Greeter, class extends Greeter {}),
      /has already been resolved on this owner/,
    );
  });
});

module("Acceptance | stubbing a class-keyed service", function (hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(function () {
    class MockGreeter extends Greeter {
      greet() {
        return "stubbed";
      }
    }

    register(this.owner, Greeter, MockGreeter);
  });

  test("the route gets the stub, with no inject step", async function (assert) {
    await visit("/");

    assert.dom("[data-test-greeting]").hasText("stubbed");
  });
});
