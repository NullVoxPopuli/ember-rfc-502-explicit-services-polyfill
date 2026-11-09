<!-- ember.nvp:start -->
# ember-rfc-502-explicit-services-polyfill

An Ember library, generated with [ember.nvp](https://github.com/NullVoxPopuli/ember.nvp).

## Check your work

After a change, run these scripts in this order:

1. `pnpm lint`
2. `pnpm test`
3. `pnpm build`

## Scripts

- `pnpm build`: `tsdown`
- `pnpm prepack`: `tsdown`
- `pnpm start`: `tsdown --watch`
- `pnpm lint:eslint`: `eslint . --cache`
- `pnpm lint:eslint:fix`: `eslint . --fix`
- `pnpm lint`: `concurrently "pnpm:lint:*(!fix)" --names "lint:" --prefixColors auto`
- `pnpm lint:fix`: `concurrently "pnpm:lint:*:fix" --names "fix:" --prefixColors auto && pnpm format`
- `pnpm format`: `prettier --write .`
- `pnpm lint:prettier`: `prettier --check .`
- `pnpm build:test`: `EMBER_ENV=test NODE_ENV=development vite build --mode development`
- `pnpm test:ci`: `testem ci --file config/test/testem.cjs --port 0`
- `pnpm test:babel`: `node --test "tests/babel/*.test.mjs"`
- `pnpm test`: `pnpm test:babel && pnpm build:test && pnpm test:ci`
- `pnpm lint:types`: `tsc --noEmit --runExternalCode`

## Modern Ember

This project uses Vite and template-tag components.
Code from older Ember versions does not work here.

- The `ember` CLI is not installed, so `ember generate` and `ember serve` fail. Use the scripts above.
- Write components in `.gjs` or `.gts` files, with `<template>`. Do not add `.hbs` files.
- Import `Component` from `@glimmer/component`, not from `@ember/component`.
- Use native classes, `@tracked`, and getters. Do not use `EmberObject`, `computed`, `get`, or `set`.
- Use `{{on}}` and `{{fn}}` in templates, not `{{action}}`.

## Project layout

- `src/` holds the source. `src/index` is the public entry point.
  A module that consumers import must be re-exported from `src/index`, or be an `entry` in `tsdown.config.js`.
- `dist/` is the build output. Do not edit it, because each build writes it again.
- `exports` in `package.json` points consumers at `dist/`.
- Declarations use isolated declarations, so each exported value needs an explicit type.
  Annotate exported template-only components with `TOC<...>`.

## Import aliases

From `imports` in `package.json`:

- `#src/*` → `./src/*`

## Guides

- [Templates](https://raw.githubusercontent.com/ember-learn/guides-source/t3/port-glimmer-cheatsheet-reference/guides/release/reference/templates.md): syntax, keywords, and helpers.
  In `<template>`, these are keywords and need no import: `on`, `fn`, `eq`, `not`, `and`, `or`, and the other comparison helpers in the reference.
- [Application state](https://raw.githubusercontent.com/ember-learn/guides-source/nvp/lifetimes-of-state/guides/release/application-state/index.md): where each piece of state lives.
- [Reactivity](https://raw.githubusercontent.com/NullVoxPopuli/guides-source/nvp/reactivity/guides/release/in-depth-topics/reactivity/index.md): tracked state and derived state.

## Tests (QUnit)

- Test files live in `tests/`.
- `pnpm test` builds the tests, then runs them in headless Chrome.
- To run only the tests whose names contain some text, build once, then filter:

  ```sh
  pnpm build:test
  pnpm test:ci --test_page "tests/index.html?hidepassed&filter=<text>"
  ```
- Read state from the DOM with `assert.dom()` from qunit-dom.

## Types

- `pnpm lint:types` checks the types, templates included.
  Use it, not plain `tsc`: without `--runExternalCode`, `tsc` cannot read `.gts` and `.gjs` files.
- Imports of `.gts` and `.gjs` modules must include the extension.
<!-- ember.nvp:end -->
