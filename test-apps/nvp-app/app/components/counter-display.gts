import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { service } from "@ember/service";

import Audit from "#app/domain/audit.ts";
import Counter from "#app/domain/counter.ts";

export default class CounterDisplay extends Component {
  @service(Counter) declare counter: Counter;
  #audit = service(this, Audit);

  increment = (): void => {
    this.counter.increment();
    this.#audit.record("increment");
  };

  <template>
    <output>{{this.counter.count}}</output>
    <button type="button" {{on "click" this.increment}}>add</button>
  </template>
}
