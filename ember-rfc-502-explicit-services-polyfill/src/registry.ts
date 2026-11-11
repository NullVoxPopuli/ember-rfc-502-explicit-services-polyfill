import { assert } from "@ember/debug";
import { associateDestroyableChild, isDestroyed, isDestroying } from "@ember/destroyable";
import { getOwner, setOwner } from "@ember/owner";

import { type Instance, isKey, type Key, nameOf } from "./key.ts";

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
   * `register` asserts if a key is already here, because a new binding would have no effect.
   * `isResolved` reads this map.
   */
  instances: WeakMap<object, Map<Key, object>>;

  /**
   * The class to build for a key on an owner. Only `register(owner, Key, Impl)` writes to it.
   *
   * `lookup` reads it only when the key has no instance yet: `bindings.get(owner)?.get(key) ?? key`.
   * A key with no binding is its own implementation, so a plain class needs no registration.
   * `unregister` deletes the binding and the instance. `hasBinding` reads this map.
   *
   * Bindings and instances are kept apart because a binding is made before the instance exists.
   * After `register(owner, Plain, Plain)`, `hasBinding` is `true`,
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

function instantiate(impl: Key, owner: Owner): object {
  const factory = impl as unknown as { create?: (props: object) => object };

  /**
   * The babel plugin swaps the base class only for classes that inject by class key.
   * A class that extends `Service` from `@ember/service` and injects only by name keeps Ember's `Service`.
   * It is an `EmberObject`, and can still be looked up by class key: `lookup(owner, FeatureFlags)`.
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
  if (typeof factory.create === "function") {
    const props = {};

    setOwner(props, owner);

    const instance = factory.create(props);

    if (!getOwner(instance)) setOwner(instance, owner);

    return instance;
  }

  const instance = new (impl as unknown as new (owner: Owner) => object)(owner);

  setOwner(instance, owner);

  return instance;
}

function assertKey(key: unknown, verb: string): asserts key is Key {
  assert(
    `Cannot ${verb} ${String(key)}: a class key must be a class. ` +
      `If the class is imported from a module that is part of an import cycle, pass \`() => Key\` instead.`,
    isKey(key),
  );
}

export function register(context: Context, key: Key, impl: Key = key): void {
  assertKey(key, "register");
  assertKey(impl, "register");

  const owner = ownerOf(context, key);

  assert(
    `Cannot register ${nameOf(impl)} under the key ${nameOf(key)}: ${nameOf(impl)} is neither ` +
      `${nameOf(key)} nor a subclass of it.`,
    impl === key || impl.prototype instanceof key,
  );

  assert(
    `${nameOf(key)} has already been resolved on this owner, so registering ${nameOf(impl)} ` +
      `would have no effect. Register before the first lookup. In a test, that means before ` +
      `render or visit.`,
    !state.instances.get(owner)?.has(key),
  );

  mapFor(state.bindings, owner).set(key, impl);
}

export function unregister(context: Context, key: Key): void {
  const owner = ownerOf(context, key);

  state.bindings.get(owner)?.delete(key);
  state.instances.get(owner)?.delete(key);
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
  const instance = instantiate(impl, owner);

  associateDestroyableChild(owner, instance);
  instances.set(key, instance);

  return instance as Instance<K>;
}
