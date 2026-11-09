export { type Instance, type Key, type KeyOrThunk } from "./key.ts";
export { type Context, hasBinding, isResolved, lookup, register, unregister } from "./registry.ts";
export { type Decorator, inject, service } from "./service.ts";

import type { Instance as KeyInstance, Key as AnyKey, KeyOrThunk as AnyKeyOrThunk } from "./key.ts";

declare module "@ember/service" {
  export function service<K extends AnyKey>(keyOrThunk: AnyKeyOrThunk<K>): PropertyDecorator;
  export function service<K extends AnyKey>(
    context: object,
    keyOrThunk: AnyKeyOrThunk<K>,
  ): KeyInstance<K>;
  export function inject<K extends AnyKey>(keyOrThunk: AnyKeyOrThunk<K>): PropertyDecorator;
  export function inject<K extends AnyKey>(
    context: object,
    keyOrThunk: AnyKeyOrThunk<K>,
  ): KeyInstance<K>;
}
