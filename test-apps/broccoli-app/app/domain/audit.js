import { service } from '@ember/service';

import Counter from './counter';
import Logger from './logger';

export default class Audit {
  #logger;

  constructor(owner) {
    this.#logger = service(owner, Logger);
  }

  get counter() {
    return service(this, Counter);
  }

  record(message) {
    this.#logger.log(`${message} at ${this.counter.count}`);
  }
}
