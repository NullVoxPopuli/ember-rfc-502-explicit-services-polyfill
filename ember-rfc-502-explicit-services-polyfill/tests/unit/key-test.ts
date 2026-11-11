import { module, test } from "qunit";

import { isKey, isThunk, resolveKey } from "#src/key.ts";

class NativeClass {}

function ConstructorFunction() {}

module("Unit | key", function () {
  test("a native class is a key", function (assert) {
    assert.true(isKey(NativeClass));
    assert.false(isThunk(NativeClass));
  });

  test("a constructor function is a key", function (assert) {
    assert.true(isKey(ConstructorFunction));
    assert.false(isThunk(ConstructorFunction));
  });

  test("an arrow function is a thunk", function (assert) {
    const thunk = () => NativeClass;

    assert.true(isThunk(thunk));
    assert.false(isKey(thunk));
    assert.strictEqual(resolveKey(thunk), NativeClass);
  });

  test("a key resolves to itself", function (assert) {
    assert.strictEqual(resolveKey(NativeClass), NativeClass);
  });

  test("non-functions are neither", function (assert) {
    for (const [label, value] of Object.entries({
      undefined,
      null: null,
      string: "service:foo",
      object: {},
      number: 1,
    })) {
      assert.false(isKey(value), label);
      assert.false(isThunk(value), label);
    }
  });
});
