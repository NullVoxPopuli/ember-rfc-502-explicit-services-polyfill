import { service } from "@ember/service";

import Counter from "./counter.ts";
import Logger from "./logger.ts";

import type Owner from "@ember/owner";

export default class Audit {
  #logger: Logger;

  constructor(owner: Owner) {
    this.#logger = service(owner, Logger);
  }

  get counter(): Counter {
    return service(this, Counter);
  }

  record(message: string): void {
    this.#logger.log(`${message} at ${this.counter.count}`);
  }
}
