import Service, { service } from "@ember/service";
import { registerDestructor } from "@ember/destroyable";

import Logger from "./logger.ts";

import type Owner from "@ember/owner";

export default class Journal extends Service {
  logger = service(this, Logger);
  closed = false;

  constructor(owner: Owner) {
    super(owner);
    registerDestructor(this, () => (this.closed = true));
  }

  write(message: string): void {
    this.logger.log(message);
  }
}
