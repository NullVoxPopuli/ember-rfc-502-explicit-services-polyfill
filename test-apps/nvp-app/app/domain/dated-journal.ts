import { service } from "@ember/service";

import Counter from "./counter.ts";
import Journal from "./journal.ts";

import type Owner from "@ember/owner";

export default class DatedJournal extends Journal {
  counter = service(this, Counter);
  opened: number;

  constructor(owner: Owner) {
    super(owner);
    this.opened = this.counter.count;
  }
}
