import { module, test } from 'qunit';
import { setupTest } from 'min-supported/tests/helpers';
import { lookup } from 'ember-rfc-502-explicit-services-polyfill';

import Editor from 'min-supported/domain/cycle/editor';
import History from 'min-supported/domain/cycle/history';

module('Unit | module cycles', function (hooks) {
  setupTest(hooks);

  test('two services that import each other inject each other with thunks', function (assert) {
    const editor = lookup(this.owner, Editor);
    const history = lookup(this.owner, History);

    assert.strictEqual(editor.history, history);
    assert.strictEqual(history.editor, editor);

    editor.type('one');
    editor.type('two');
    history.undo();

    assert.strictEqual(editor.text, 'one');
  });
});
