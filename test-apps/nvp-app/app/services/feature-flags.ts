import Service from "@ember/service";

export default class FeatureFlags extends Service {
  enabled = new Set(["explicit-di"]);

  isEnabled(name: string): boolean {
    return this.enabled.has(name);
  }
}

declare module "@ember/service" {
  interface Registry {
    "feature-flags": FeatureFlags;
  }
}
