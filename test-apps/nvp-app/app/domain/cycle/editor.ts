import { service } from "@ember/service";

import History from "./history.ts";

export default class Editor {
  @service(() => History) declare history: History;

  text = "";

  type(text: string): void {
    this.history.push(this.text);
    this.text = text;
  }
}
