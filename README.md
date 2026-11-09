# ember-rfc-502-explicit-services-polyfill

Use classes as service keys, as proposed in [RFC 502: Explicit Service Injection](https://github.com/emberjs/rfcs/pull/502), on ember-source 4.12 and newer.

```js
import Component from "@glimmer/component";
import { service } from "@ember/service";

import Notifications from "my-app/services/notifications";

export default class Demo extends Component {
  @service(Notifications) notifications;
}
```

"Go to definition" on `Notifications` opens the service. The service does not have to live in `app/services`, and it does not have to extend `Service`.

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

The plugin also adds `import 'ember-rfc-502-explicit-services-polyfill/install'` to modules that import from `@ember/application`, `@ember/owner`, `@ember/engine`, `ember-qunit` or `@ember/test-helpers`. That import lets `owner.lookup`, `owner.register` and `owner.unregister` accept classes.

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

### ember.nvp apps

Add the plugin to `babel.config.js` as for Vite apps. `@nullvoxpopuli/ember-vite` uses oxc for files that do not need babel, so also tell it to use babel for these imports, in `vite.config.mjs`:

```js
ember({
  babel: {
    include: {
      whenImporting: [
        "@ember/service",
        "@ember/application",
        "@ember/owner",
        "ember-qunit",
        "@ember/test-helpers",
      ],
    },
  },
});
```

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
- The checks in `register` and the "no owner" message use `assert` from `@ember/debug`, which is removed from production builds.
- Production builds minify class names, so error messages show the minified name.
- Each engine instance is its own owner, so each engine gets its own instances.
- Template-only components and plain-function helpers have no `this`. Use a getter on a class, or pass the service in.
- If two copies of the polyfill are installed, they share their state. If two copies of a package that defines a key are installed, each copy is a different key.

## Compatibility

- ember-source 4.12 or newer
- Vite apps, classic broccoli apps, ember.nvp apps, v1 addons and v2 addons

The test apps in `test-apps/` run the same suite in an ember-cli Vite app, a broccoli app generated by ember-cli 6.7, and an ember.nvp app.

## License

MIT
