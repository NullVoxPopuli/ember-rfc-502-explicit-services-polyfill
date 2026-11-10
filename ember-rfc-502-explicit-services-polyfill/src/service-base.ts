import { destroy } from "@ember/destroyable";
import { getOwner, setOwner } from "@ember/owner";

import type Owner from "@ember/owner";

/**
 * The base class that RFC 502 describes for services.
 * In the real implementation, this is `Service` from `@ember/service`.
 *
 * Extending it is optional.
 * It sets the owner before the fields of a subclass run,
 * so a field can inject:
 *
 * ```js
 * import Service, { service } from '@ember/service';
 *
 * export default class Audit extends Service {
 *   logger = service(this, Logger);
 * }
 * ```
 *
 * The babel plugin makes a class extend this one in place of `Service` from `@ember/service`
 * when the class uses a class key or `service(this, Key)`.
 * It is not an `EmberObject`, so the plugin reports an error for `init`, `willDestroy`,
 * and `Service.extend()` in those classes.
 *
 * A subclass that has a constructor must call `super(owner)`.
 */
export class Service {
  static create<T extends Service>(this: new (owner: Owner) => T, props: object): T {
    const owner = getOwner(props);

    return new this(owner as Owner);
  }

  constructor(owner: Owner) {
    setOwner(this, owner);
  }

  destroy(): void {
    destroy(this);
  }
}
