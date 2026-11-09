import Service, { service } from '@ember/service';

import Counter from './counter';

export default class Session extends Service {
  @service('feature-flags') flags;
  @service(Counter) counter;

  user = 'anonymous';
}
