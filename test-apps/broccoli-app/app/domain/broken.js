import { service } from '@ember/service';

import Logger from './logger';

export default class Broken {
  logger = service(this, Logger);
}
