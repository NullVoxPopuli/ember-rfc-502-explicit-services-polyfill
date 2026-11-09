import { service } from "@ember/service";

import Editor from "./editor.ts";

export default class History {
  @service(() => Editor) declare editor: Editor;

  entries: string[] = [];

  push(entry: string): void {
    this.entries.push(entry);
  }

  undo(): void {
    this.editor.text = this.entries.pop() ?? "";
  }
}
