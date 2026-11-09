import { module, test } from "qunit";
import { setupTest } from "ember-qunit";
import { lookup } from "ember-rfc-502-explicit-services-polyfill";

import Editor from "#app/domain/cycle/editor.ts";
import History from "#app/domain/cycle/history.ts";

module("Unit | module cycles", function (hooks) {
  setupTest(hooks);

  test("two services that import each other inject each other with thunks", function (assert) {
    const editor = lookup(this.owner, Editor);
    const history = lookup(this.owner, History);

    assert.strictEqual(editor.history, history);
    assert.strictEqual(history.editor, editor);

    editor.type("one");
    editor.type("two");
    history.undo();

    assert.strictEqual(editor.text, "one");
  });
});
