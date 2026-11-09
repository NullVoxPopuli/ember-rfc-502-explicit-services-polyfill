import Component from "@glimmer/component";
import { service } from "@ember/service";

import Counter from "#app/domain/counter.ts";

import type FeatureFlags from "#app/services/feature-flags.ts";

export default class Dashboard extends Component {
  @service("feature-flags") declare flags: FeatureFlags;
  @service(Counter) declare counter: Counter;

  get explicit(): string {
    return this.flags.isEnabled("explicit-di") ? "on" : "off";
  }

  <template>
    <p data-test-flags>{{this.explicit}}</p>
    <p data-test-count>{{this.counter.count}}</p>
  </template>
}
