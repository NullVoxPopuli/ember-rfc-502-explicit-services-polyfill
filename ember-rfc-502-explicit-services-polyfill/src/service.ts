import { assert } from "@ember/debug";
import * as emberService from "@ember/service";

import { type Instance, type Key, type KeyOrThunk, resolveKey } from "./key.ts";
import { type Context, lookup } from "./registry.ts";

import type { Registry as ServiceRegistry } from "@ember/service";

const emberInject = (emberService.service ?? emberService.inject) as (
  ...args: unknown[]
) => unknown;

export type Decorator = (target: object, propertyKey: string | symbol, descriptor?: object) => void;

function decoratorFor<K extends Key>(keyOrThunk: KeyOrThunk<K>): Decorator {
  return function (_target: object, propertyKey: string | symbol) {
    return {
      configurable: true,
      enumerable: true,

      get(this: object): Instance<K> {
        return lookup(this, resolveKey(keyOrThunk));
      },

      set(this: object, value: Instance<K>) {
        Object.defineProperty(this, propertyKey, {
          configurable: true,
          enumerable: true,
          writable: true,
          value,
        });
      },
    };
  };
}

function isLegacyDecoratorCall(args: unknown[]): boolean {
  return typeof args[1] === "string" || typeof args[1] === "symbol";
}

function missingKey(): string {
  return (
    "service() was called with undefined. This usually means the class is imported from a " +
    "module that has not finished evaluating, because of an import cycle. Pass `() => Key` instead."
  );
}

export function service(target: object, propertyKey: string | symbol, descriptor?: object): void;
export function service(): Decorator;
export function service<N extends keyof ServiceRegistry & string>(name: N): Decorator;
export function service(name: string): Decorator;
export function service<K extends Key>(keyOrThunk: KeyOrThunk<K>): Decorator;
export function service<K extends Key>(context: Context, keyOrThunk: KeyOrThunk<K>): Instance<K>;

export function service(...args: unknown[]): unknown {
  if (args.length === 0 || typeof args[0] === "string" || isLegacyDecoratorCall(args)) {
    return emberInject(...args);
  }

  if (args.length === 1) {
    assert(missingKey(), args[0] !== undefined);

    return decoratorFor(args[0] as KeyOrThunk<Key>);
  }

  assert(missingKey(), args[1] !== undefined);

  return lookup(args[0] as Context, resolveKey(args[1] as KeyOrThunk<Key>));
}

export const inject: typeof service = service;
