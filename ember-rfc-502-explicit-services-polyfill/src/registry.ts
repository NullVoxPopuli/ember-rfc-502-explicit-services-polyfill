import { assert } from "@ember/debug";
import { associateDestroyableChild, isDestroyed, isDestroying } from "@ember/destroyable";
import { getOwner, setOwner } from "@ember/owner";

import { type Instance, isClassKey, isFactory, isKey, type Key, nameOf } from "./key.ts";

import type Owner from "@ember/owner";

export type Context = Owner | object;

/**
 * The registry for class keys, per owner.
 * Each outer map is a `WeakMap` keyed on the owner, so an owner's state
 * does not leak into other owners (another test, another engine),
 * and is garbage-collected with the owner.
 */
interface State {
  /**
   * The singleton that the first `lookup` of a key built on an owner.
   *
   * `overrideService` asserts if a key is already here, because a new binding would have no effect.
   * `isResolved` reads this map.
   */
  instances: WeakMap<object, Map<Key, object>>;

  /**
   * The class to build for a key on an owner. Only `overrideService(owner, Key, Impl)` writes to it.
   *
   * `lookup` reads it only when the key has no instance yet: `bindings.get(owner)?.get(key) ?? key`.
   * A key with no binding is its own implementation, so a plain class needs no registration.
   * `hasBinding` reads this map.
   *
   * Bindings and instances are kept apart because a binding is made before the instance exists.
   * After `overrideService(owner, Key, Impl)`, `hasBinding` is `true`,
   * but `isResolved` is `false` until the first lookup.
   */
  bindings: WeakMap<object, Map<Key, Key>>;
}

const STATE_KEY = Symbol.for("ember-rfc-502-explicit-services-polyfill:state");

const state: State = ((globalThis as Record<symbol, State | undefined>)[STATE_KEY] ??= {
  instances: new WeakMap(),
  bindings: new WeakMap(),
});

function mapFor<V>(store: WeakMap<object, Map<Key, V>>, owner: object): Map<Key, V> {
  let map = store.get(owner);

  if (!map) {
    map = new Map();
    store.set(owner, map);
  }

  return map;
}

export function isOwner(value: unknown): value is Owner {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<Record<"lookup" | "register", unknown>>;

  return typeof candidate.lookup === "function" && typeof candidate.register === "function";
}

export function ownerOf(context: Context, forKey?: Key): Owner {
  const owner = isOwner(context) ? context : getOwner(context);

  assert(
    `Cannot resolve ${forKey ? nameOf(forKey) : "a service"} from ${nameOf(context.constructor)}: ` +
      `it has no owner. A plain class gets its owner after its constructor returns, so a field ` +
      `initializer cannot inject. Extend Service from @ember/service, and call super(owner) in ` +
      `a constructor. Or inject from the owner passed to the constructor, or from a getter.`,
    owner,
  );

  return owner;
}

function isObject(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

/**
 * Whether `impl` can stand in for `key`.
 *
 * A key that is not a class has no hierarchy to protect,
 * so anything can stand in for it.
 *
 * `class B extends A` sets the prototype of `B` to `A`,
 * and `{ __proto__: Key, create() {} }` does the same for a factory object,
 * so one `isPrototypeOf` check covers both.
 * A constructor function that only sets `B.prototype` needs the second check.
 */
function isSubstitute(key: Key, impl: Key): boolean {
  if (!isClassKey(key)) return true;
  if (impl === key || Object.prototype.isPrototypeOf.call(key, impl)) return true;

  return isClassKey(impl) && impl.prototype instanceof key;
}

function instantiate(key: Key, impl: Key, owner: Owner): object {
  /**
   * The babel plugin swaps the base class only for classes that inject by class key.
   * A class that extends `Service` from `@ember/service` and injects only by name keeps Ember's `Service`.
   * It is an `EmberObject`, and can still be looked up by class key: `service(owner, FeatureFlags)`.
   * `new` skips `init`, so `create` is required.
   *
   * The polyfill's `Service` also has a static `create`, so this branch makes it too.
   * Here, `new` would work as well, because its constructor takes the owner.
   *
   * The polyfill's `Service` needs `create` for a different path, which does not go through this registry.
   * After `owner.register('service:audit', Audit)`, `owner.lookup('service:audit')` makes the instance in Ember's container.
   * The container never uses `new`.
   * It asserts that the class has a static `create`,
   * puts the owner on a props object with `setOwner(props, owner)`, and calls `Audit.create(props)`.
   * The polyfill's `create` reads the owner back with `getOwner(props)`, and calls `new this(owner)`.
   */
  if (isFactory(impl)) {
    const props = {};

    setOwner(props, owner);

    const instance: unknown = impl.create(props);

    assert(
      `${nameOf(impl)}.create() must return an object, and returned ${String(instance)}.`,
      isObject(instance),
    );

    /**
     * When the key is its own implementation, `create` can return anything.
     * An override must return an instance of the key,
     * because consumers of the key rely on its type.
     */
    assert(
      `${nameOf(impl)}.create() must return an instance of ${nameOf(key)}, ` +
        `because ${nameOf(impl)} overrides ${nameOf(key)}.`,
      impl === key || !isClassKey(key) || instance instanceof key,
    );

    if (!getOwner(instance)) setOwner(instance, owner);

    return instance;
  }

  const instance = new (impl as unknown as new (owner: Owner) => object)(owner);

  setOwner(instance, owner);

  return instance;
}

function assertKey(key: unknown, verb: string): asserts key is Key {
  assert(
    `Cannot ${verb} ${nameOf(key)}: a key must be a class, or an object with a create() method. ` +
      `If the class is imported from a module that is part of an import cycle, pass \`() => Key\` instead.`,
    isKey(key),
  );
}

export function overrideService(owner: Owner, key: Key, impl: Key): void {
  assertKey(key, "override");
  assertKey(impl, "override");
  assert(
    `Cannot override ${nameOf(key)}: overrideService needs an owner as its first argument.`,
    isOwner(owner),
  );

  assert(
    `Cannot override ${nameOf(key)} with ${nameOf(impl)}: ${nameOf(impl)} is neither ` +
      `${nameOf(key)} nor a subclass of it.`,
    isSubstitute(key, impl),
  );

  assert(
    `${nameOf(key)} has already been resolved on this owner, so overriding it with ${nameOf(impl)} ` +
      `would have no effect. Override before the first lookup. In a test, that means before ` +
      `render or visit.`,
    !state.instances.get(owner)?.has(key),
  );

  mapFor(state.bindings, owner).set(key, impl);
}

export function hasBinding(context: Context, key: Key): boolean {
  return state.bindings.get(ownerOf(context, key))?.has(key) ?? false;
}

export function isResolved(context: Context, key: Key): boolean {
  return state.instances.get(ownerOf(context, key))?.has(key) ?? false;
}

export function lookup<K extends Key>(context: Context, key: K): Instance<K> {
  assertKey(key, "look up");

  const owner = ownerOf(context, key);
  const instances = mapFor(state.instances, owner);
  const existing = instances.get(key);

  if (existing) return existing as Instance<K>;

  assert(
    `Cannot look up ${nameOf(key)} on an owner that is destroyed or being destroyed.`,
    !isDestroying(owner) && !isDestroyed(owner),
  );

  const impl = state.bindings.get(owner)?.get(key) ?? key;
  const instance = instantiate(key, impl, owner);

  associateDestroyableChild(owner, instance);
  instances.set(key, instance);

  return instance as Instance<K>;
}
