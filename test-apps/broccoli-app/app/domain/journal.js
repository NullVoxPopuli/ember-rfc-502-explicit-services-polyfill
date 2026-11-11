import Service, { service } from '@ember/service';
import { registerDestructor } from '@ember/destroyable';

import Logger from './logger';

export default class Journal extends Service {
  logger = service(this, Logger);
  closed = false;

  constructor(owner) {
    super(owner);
    registerDestructor(this, () => (this.closed = true));
  }

  write(message) {
    this.logger.log(message);
  }
}
