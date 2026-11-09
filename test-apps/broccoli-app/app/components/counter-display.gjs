import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import { service } from '@ember/service';

import Audit from 'broccoli-app/domain/audit';
import Counter from 'broccoli-app/domain/counter';

export default class CounterDisplay extends Component {
  @service(Counter) counter;
  #audit = service(this, Audit);

  increment = () => {
    this.counter.increment();
    this.#audit.record('increment');
  };

  <template>
    <output>{{this.counter.count}}</output>
    <button type="button" {{on "click" this.increment}}>add</button>
  </template>
}
