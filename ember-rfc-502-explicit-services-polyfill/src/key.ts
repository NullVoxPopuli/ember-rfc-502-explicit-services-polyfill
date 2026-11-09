import type Owner from "@ember/owner";

export type Key<T extends object = object> = abstract new (owner: Owner) => T;

export type Instance<K extends Key> = K extends abstract new (owner: Owner) => infer T ? T : never;

export type KeyOrThunk<K extends Key> = K | (() => K);

export function isThunk(value: unknown): value is () => Key {
  return typeof value === "function" && !Object.prototype.hasOwnProperty.call(value, "prototype");
}

export function isKey(value: unknown): value is Key {
  return typeof value === "function" && Object.prototype.hasOwnProperty.call(value, "prototype");
}

export function resolveKey<K extends Key>(keyOrThunk: KeyOrThunk<K>): K {
  return isThunk(keyOrThunk) ? keyOrThunk() : keyOrThunk;
}

export function nameOf(key: unknown): string {
  return (typeof key === "function" && key.name) || "an anonymous class";
}
