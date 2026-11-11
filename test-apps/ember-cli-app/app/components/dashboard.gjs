import Component from '@glimmer/component';
import { service } from '@ember/service';

import Counter from 'ember-cli-app/domain/counter';

export default class Dashboard extends Component {
  @service('feature-flags') flags;
  @service(Counter) counter;

  get explicit() {
    return this.flags.isEnabled('explicit-di') ? 'on' : 'off';
  }

  <template>
    <p data-test-flags>{{this.explicit}}</p>
    <p data-test-count>{{this.counter.count}}</p>
  </template>
}
