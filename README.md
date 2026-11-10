# ember-rfc-502-explicit-services-polyfill

Use classes as service keys, as proposed in [RFC 502: Explicit Service Injection](https://github.com/emberjs/rfcs/pull/502), on ember-source 3.28 and newer.

```js
import Component from "@glimmer/component";
import { service } from "@ember/service";

import Notifications from "my-app/notifications/service";

export default class Demo extends Component {
  @service(Notifications) notifications;
}
```

"Go to definition" on `Notifications` opens the service. The service does not have to extend `Service`, and it should not live in `app/services`. See [Where to put services](#where-to-put-services).

## Install

```bash
pnpm add ember-rfc-502-explicit-services-polyfill
```

Then add the babel plugin. The plugin changes:

```js
import { service } from "@ember/service";
```

to:

```js
import { service } from "ember-rfc-502-explicit-services-polyfill";
```

`inject` moves too. `Service` and type-only imports stay on `@ember/service`.

The plugin also rewrites owner method calls whose first argument is not a string, so that `owner.lookup`, `owner.register`, `owner.unregister` and `owner.hasRegistration` accept classes:

```js
this.owner.register(Greeter, MockGreeter);
// becomes
ownerRegister(this.owner, Greeter, MockGreeter);
```

`ownerRegister` comes from `ember-rfc-502-explicit-services-polyfill/owner`. It sends a class key to the polyfill's registry, and passes anything else to the owner's own method. Ember's prototypes are not changed. Calls with a string or template literal, such as `owner.lookup('service:session')`, are not rewritten.

The plugin only changes files in packages that list the polyfill in `dependencies`, `devDependencies` or `peerDependencies`. Your addons are not changed unless they depend on the polyfill.

### Vite apps (ember-cli 6.8 and newer)

In `babel.config.mjs`, add the plugin to the start of `plugins`:

```js
export default {
  plugins: [
    "ember-rfc-502-explicit-services-polyfill/babel-plugin",
    // ...the rest of your plugins
  ],
};
```

### Classic (broccoli) apps

In `ember-cli-build.js`:

```js
const app = new EmberApp(defaults, {
  babel: {
    plugins: [require.resolve("ember-rfc-502-explicit-services-polyfill/babel-plugin")],
  },
});
```

#### ember-source older than 4.12

The polyfill imports `getOwner` and `setOwner` from `@ember/owner`. On ember-source older than 4.12, those imports must be rewritten to `@ember/application`. Add [babel-plugin-ember-polyfill-get-and-set-owner-from-ember-owner](https://github.com/NullVoxPopuli/ember-polyfill-get-and-set-owner-from-ember-owner) and `babel-loader`:

```bash
pnpm add -D babel-plugin-ember-polyfill-get-and-set-owner-from-ember-owner babel-loader
```

The polyfill is a v2 addon, so ember-auto-import compiles it with webpack, not with the app's babel config. Add the owner plugin in both places:

```js
const ownerPolyfill =
  require.resolve("babel-plugin-ember-polyfill-get-and-set-owner-from-ember-owner");

const app = new EmberApp(defaults, {
  babel: {
    plugins: [
      ownerPolyfill,
      require.resolve("ember-rfc-502-explicit-services-polyfill/babel-plugin"),
    ],
  },
  autoImport: {
    webpack: {
      module: {
        rules: [
          {
            test: /\.js$/,
            include: /ember-rfc-502-explicit-services-polyfill/,
            use: {
              loader: require.resolve("babel-loader"),
              options: { babelrc: false, configFile: false, plugins: [ownerPolyfill] },
            },
          },
        ],
      },
    },
  },
});
```

Without the webpack rule, the app fails at boot with "Could not find module `@ember/owner`".

### ember.nvp apps

Add the plugin to `babel.config.js` as for Vite apps. `@nullvoxpopuli/ember-vite` compiles a file with oxc unless the file needs babel. In `vite.config.mjs`, send the files that use the polyfill to babel:

```js
ember({
  babel: {
    include: {
      whenImporting: ["@ember/service", "ember-rfc-502-explicit-services-polyfill"],
    },
  },
});
```

`whenImporting` can only match imports. An `owner.register(Key, Impl)` call in a file that imports neither package is compiled by oxc, so it is not rewritten. In such a file, import `register` from the polyfill and call `register(owner, Key, Impl)`.

### Addons

For a v1 addon, add the plugin to `options.babel.plugins` in `index.js`. For a v2 addon, add it to `babel.publish.config.cjs`. In both cases, put the polyfill in `dependencies` and `ember-source` in `peerDependencies`.

## Usage

| call                        | does                                                  |
| --------------------------- | ----------------------------------------------------- |
| `@service(Key)`             | resolves on first access                              |
| `@service(() => Key)`       | resolves on first access, and works in a module cycle |
| `service(this, Key)`        | resolves now                                          |
| `service(this, () => Key)`  | resolves now, and works in a module cycle             |
| `@service('name')`          | unchanged: looks up `service:name`                    |
| `@service` and `@service()` | unchanged: looks up the name of the field             |

The first lookup of a key creates the instance. One owner has one instance per key. A class with a static `create` (an `EmberObject`, such as `Service`) is made with `create`. Any other class is made with `new Key(owner)`, and then gets `setOwner`. Each instance is destroyed with its owner, so `registerDestructor` works in a plain class.

A class key never falls back to the resolver. `lookup(owner, FeatureFlags)` and `owner.lookup('service:feature-flags')` give two different instances.

### Where to put services

Put class-keyed services next to the code that uses them, not in `app/services`.

A class key is an import, so a service is part of the import graph. A module that injects the service imports it, and the browser evaluates the service's module only when that module is loaded. With route splitting, a service that only a lazy route uses stays out of the initial bundle.

`app/services` defeats this in Vite apps. The resolver's modules come from `@embroider/virtual/compat-modules`, which imports every file in `app/services` at boot. A service there is evaluated at boot, even if nothing injects it until a lazy route loads. Classic apps ship all of `app/` in one bundle, so there the location changes less.

Only a service that is looked up by a string name, such as `@service('session')`, has to be in `app/services`.

### Lazy access without a decorator

`service(this, Key)` in a field resolves when the field is set. To resolve on first access, use a getter. Repeat calls return the same instance.

```js
class Demo extends Component {
  get notifications() {
    return service(this, Notifications);
  }
}
```

### Plain classes

The owner is set after the constructor returns. A field in a plain class cannot inject, because `this` has no owner yet. Use the owner that the constructor gets, or a getter:

```js
export default class Audit {
  #logger;

  constructor(owner) {
    this.#logger = service(owner, Logger);
  }

  get counter() {
    return service(this, Counter);
  }
}
```

Glimmer components and `EmberObject` subclasses have their owner before their fields run, so fields work there.

### Module cycles

If two services import each other, use the thunk form on both sides:

```js
export default class Editor {
  @service(() => History) history;
}

export default class History {
  @service(() => Editor) editor;
}
```

A thunk must be an arrow function. The polyfill treats any function with a `prototype` as a class.

### Choosing an implementation

`register` binds a key to a subclass. Register before the first lookup of the key:

```js
import { CookieStore } from "my-app/cookies/cookie-store";
import { ServerCookieStore } from "my-app/cookies/server-cookie-store";
import { BrowserCookieStore } from "my-app/cookies/browser-cookie-store";

export function initialize(appInstance) {
  if (appInstance.lookup("service:fastboot")?.isFastBoot) {
    appInstance.register(CookieStore, ServerCookieStore);
  } else {
    appInstance.register(CookieStore, BrowserCookieStore);
  }
}
```

`register` throws if the implementation is not the key or a subclass of the key. It also throws if the key was already resolved on that owner, because the registration would have no effect.

## Testing

Register a stub before `render` or `visit`. There is no `inject` step.

```js
module("Acceptance | greeting", function (hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(function () {
    class MockGreeter extends Greeter {
      greet() {
        return "stubbed";
      }
    }

    this.owner.register(Greeter, MockGreeter);
  });
});
```

A plain-class service with no owner dependencies needs no setup in a unit test: `new Counter()`.

Assigning to a decorated field (`this.counter = stub`) replaces the value on that one instance.

## Functions

These work with an owner or with any object that has one:

| function                       | does                                            |
| ------------------------------ | ----------------------------------------------- |
| `lookup(context, Key)`         | the same as `owner.lookup(Key)`                 |
| `register(context, Key, Impl)` | the same as `owner.register(Key, Impl)`         |
| `unregister(context, Key)`     | removes the binding and the instance            |
| `hasBinding(context, Key)`     | `true` if `register` was called for the key     |
| `isResolved(context, Key)`     | `true` if the key has an instance on this owner |

`owner.hasRegistration(Key)` throws. The RFC leaves it open, and for a class key the answer is always yes. Use `hasBinding` or `isResolved`.

## TypeScript

Add the polyfill to `compilerOptions.types`:

```json
{
  "compilerOptions": {
    "types": ["ember-source/types", "ember-rfc-502-explicit-services-polyfill"]
  }
}
```

This adds the class-key overloads to `service` and `inject` from `@ember/service`. Decorated fields still need a type, because decorators cannot change the type of a field:

```ts
@service(Counter) declare counter: Counter;
```

`service(this, Counter)` returns `Counter`, so fields and getters need no annotation.

A key can be an abstract class. The `Owner` type is not changed, so in TypeScript use `register(owner, Key, Impl)` and `lookup(owner, Key)` from the polyfill.

## Known limitations

- Classic `.extend({ foo: service(Key) })` does not support class keys. The string forms still work there.
- Standard (stage 3) decorators are not supported.
- Owner calls are only rewritten in files the babel plugin compiles. Calls through a computed name, such as `owner[method](Key)`, or with a spread first argument are not rewritten.
- The checks in `register` and the "no owner" message use `assert` from `@ember/debug`, which is removed from production builds.
- Production builds minify class names, so error messages show the minified name.
- Each engine instance is its own owner, so each engine gets its own instances.
- Template-only components and plain-function helpers have no `this`. Use a getter on a class, or pass the service in.
- If two copies of the polyfill are installed, they share their state. If two copies of a package that defines a key are installed, each copy is a different key.

## Compatibility

- ember-source 3.28 or newer. Below 4.12, see [ember-source older than 4.12](#ember-source-older-than-412).
- Vite apps, classic broccoli apps, ember.nvp apps, v1 addons and v2 addons

The test apps in `test-apps/` run the same suite in four apps:

- `ember-cli-app`: an ember-cli Vite app
- `broccoli-app`: a broccoli app generated by ember-cli 6.7
- `nvp-app`: an ember.nvp app
- `min-supported`: a broccoli app on ember-source 3.28 and 4.8, with ember-cli 4.12

## License

MIT
