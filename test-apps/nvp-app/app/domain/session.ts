import Service, { service } from "@ember/service";

import Counter from "./counter.ts";

import type FeatureFlags from "#app/services/feature-flags.ts";

export default class Session extends Service {
  @service("feature-flags") declare flags: FeatureFlags;
  @service(Counter) declare counter: Counter;

  user = "anonymous";
}
