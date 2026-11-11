import Service from '@ember/service';

export default class FeatureFlags extends Service {
  enabled = new Set(['explicit-di']);

  isEnabled(name) {
    return this.enabled.has(name);
  }
}
