/**
 * Stand-ins for the owner methods that RFC 502 extends to class keys.
 *
 * RFC 502 writes its examples against the owner:
 *
 * ```js
 * this.owner.register(Greeter, MockGreeter);
 * appInstance.lookup(CookieStore);
 * ```
 *
 * Ember only knows string names such as `'service:greeter'`,
 * and asserts on anything else.
 * Patching Ember's prototypes would change every owner in the page, for every package.
 * The babel plugin rewrites each call whose first argument might be a class instead:
 *
 * ```js
 * this.owner.register(Greeter, MockGreeter);
 * // becomes
 * ownerRegister(this.owner, Greeter, MockGreeter);
 * ```
 *
 * A string or template literal can only be a name, so those calls are not rewritten.
 * Any other argument could still be a name at runtime, such as `owner.lookup(fullName)`.
 * That is why each function here checks again.
 * When the receiver is an owner and the argument is a class,
 * the call goes to the class-keyed registry in `registry.ts`.
 * That registry keeps its instances in a `WeakMap` keyed on the owner.
 * Otherwise the call goes to the receiver's own method, unchanged,
 * so a `lookup` method on something that is not an owner keeps working.
 *
 * `ownerHasRegistration` throws for a class.
 * A class key always resolves, so the answer would always be yes.
 * `hasBinding` and `isResolved` answer the useful questions instead.
 *
 * Only files that the babel plugin compiles get this behavior.
 * Ember's own code and addons that do not depend on the polyfill
 * only ever pass names, so they do not need it.
 *
 * In TypeScript, the `Owner` type still only takes strings.
 * Typed code uses `lookup(owner, Key)` and `register(owner, Key, Impl)` instead.
 */
import { isKey, nameOf } from "./key.ts";
import { isOwner, lookup, register, unregister } from "./registry.ts";

type Receiver = Record<string, (...args: unknown[]) => unknown>;

function handlesKey(owner: unknown, key: unknown): owner is object {
  return isOwner(owner) && isKey(key);
}

export function ownerLookup(owner: unknown, key: unknown, ...rest: unknown[]): unknown {
  if (handlesKey(owner, key)) return lookup(owner, key as never);

  return (owner as Receiver)["lookup"]!(key, ...rest);
}

export function ownerRegister(
  owner: unknown,
  key: unknown,
  implementation?: unknown,
  ...rest: unknown[]
): unknown {
  if (handlesKey(owner, key)) {
    register(owner, key as never, (implementation ?? key) as never);

    return undefined;
  }

  return (owner as Receiver)["register"]!(key, implementation, ...rest);
}

export function ownerUnregister(owner: unknown, key: unknown, ...rest: unknown[]): unknown {
  if (handlesKey(owner, key)) {
    unregister(owner, key as never);

    return undefined;
  }

  return (owner as Receiver)["unregister"]!(key, ...rest);
}

export function ownerHasRegistration(owner: unknown, key: unknown, ...rest: unknown[]): unknown {
  if (handlesKey(owner, key)) {
    throw new Error(
      `hasRegistration only accepts string names, and was given ${nameOf(key)}. ` +
        `A class key always resolves, because it instantiates itself. ` +
        `Use hasBinding() or isResolved() from ember-rfc-502-explicit-services-polyfill.`,
    );
  }

  return (owner as Receiver)["hasRegistration"]!(key, ...rest);
}
