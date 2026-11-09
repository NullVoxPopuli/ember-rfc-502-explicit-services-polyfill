import * as applicationInstance from "@ember/application/instance";
import * as engineInstance from "@ember/engine/instance";

import { isKey, type Key, nameOf } from "./key.ts";
import { lookup, register, unregister } from "./registry.ts";

import type Owner from "@ember/owner";

const PATCHED = Symbol.for("ember-rfc-502-explicit-services-polyfill:patched");

type Method = ((this: Owner, ...args: unknown[]) => unknown) & { [PATCHED]?: true };

const overrides: Record<string, (original: Method) => Method> = {
  lookup: (original) =>
    function (this: Owner, fullName, ...rest) {
      return isKey(fullName) ? lookup(this, fullName) : original.call(this, fullName, ...rest);
    },

  register: (original) =>
    function (this: Owner, fullName, factory, ...rest) {
      if (isKey(fullName))
        return register(this, fullName, (factory as Key | undefined) ?? fullName);

      return original.call(this, fullName, factory, ...rest);
    },

  unregister: (original) =>
    function (this: Owner, fullName, ...rest) {
      return isKey(fullName) ? unregister(this, fullName) : original.call(this, fullName, ...rest);
    },

  hasRegistration: (original) =>
    function (this: Owner, fullName, ...rest) {
      if (isKey(fullName)) {
        throw new Error(
          `hasRegistration only accepts string names, and was given ${nameOf(fullName)}. ` +
            `A class key always resolves, because it instantiates itself. ` +
            `Use hasBinding() or isResolved() from ember-rfc-502-explicit-services-polyfill.`,
        );
      }

      return original.call(this, fullName, ...rest);
    },
};

function classOf(module: unknown): unknown {
  let value = module;

  while (value && typeof value === "object" && "default" in value) {
    value = value.default;
  }

  return value;
}

function patch(klass: unknown): void {
  const finalize = (klass as { proto?: () => object }).proto;

  if (typeof finalize === "function") finalize.call(klass);

  const prototype = (klass as { prototype: Record<string, Method> }).prototype;

  for (const [name, wrap] of Object.entries(overrides)) {
    const original = prototype[name];

    if (typeof original !== "function" || original[PATCHED]) continue;

    const wrapped = wrap(original);

    wrapped[PATCHED] = true;
    prototype[name] = wrapped;
  }
}

patch(classOf(engineInstance));
patch(classOf(applicationInstance));
