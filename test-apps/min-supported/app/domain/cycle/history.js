import { service } from '@ember/service';

import Editor from './editor';

export default class History {
  @service(() => Editor) editor;

  entries = [];

  push(entry) {
    this.entries.push(entry);
  }

  undo() {
    this.editor.text = this.entries.pop() ?? '';
  }
}
