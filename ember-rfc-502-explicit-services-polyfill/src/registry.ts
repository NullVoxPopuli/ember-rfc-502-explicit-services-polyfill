import { assert } from "@ember/debug";
import { associateDestroyableChild, isDestroyed, isDestroying } from "@ember/destroyable";
import { getOwner, setOwner } from "@ember/owner";

import { type Instance, isKey, type Key, nameOf } from "./key.ts";

import type Owner from "@ember/owner";

export type Context = Owner | object;

interface State {
  instances: WeakMap<object, Map<Key, object>>;
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
