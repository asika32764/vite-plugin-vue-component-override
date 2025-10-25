# Vite Plugin: vue-component-override

This plugin is an experimental proof-of-concept that lets developers override Vue Single File Components without
changing the original SFC files.

It allows overriding Vue components, which is useful when an app needs to change component behavior for different
environments or requirements.

## Introduction

Because of how Vue templates are compiled and how Vite/Rollup bundle code, once a component library is compiled into JS
there is no way to replace or force-override components at runtime in a consuming project. This plugin injects a
resolver at build time so consuming projects can override specific components as needed.

### How it works

During build, the plugin finds any import statements that load `*.vue` components and replaces them with a call to a
resolver function:

```ts
import Foo from '~myui/components/Foo.vue';

// Convert to:

import { resolveVueComponent as __VUE_COMPONENT_OVERRIDE_RESOLVE_4523368__ } from 'vite-plugin-vue-component-override';
import Foo_Tmp45833 from '~myui/components/Foo.vue';

const Foo = __VUE_COMPONENT_OVERRIDE_RESOLVE_4523368__('{component-alias}', Foo_Tmp45833);
```

If the app using the library has overridden a component, `resolveComponent` returns the overridden component; otherwise
it returns the original.

The plugin also supports async imports.

```ts
const Foo = defineAsyncComponent(() => import('~myui/components/Foo.vue'));

// Convert to:

import { resolveVueAsyncComponent } from 'vite-plugin-vue-component-override';

const Foo = defineAsyncComponent(() => resolveVueAsyncComponent('{component-alias}') ?? import('~myui/components/Foo.vue'));
```

### Limitations and Use Cases

This plugin must inject the resolver during the component-library build, so it cannot override components in
already-published `npm` libraries. It is useful for companies or teams that maintain internal libraries and need to
change library behavior for specific projects.

## Installation

```bash
npm install vite-plugin-vue-component-override --save-dev

＃OR

yarn add vite-plugin-vue-component-override --dev
```

## Usage: When developing the library

Add to vite.config.js:

```js
import vueComponentOverride from 'vite-plugin-vue-component-override/plugin';

// ...

export default defineConfig({
  // ...
  plugins: [
    vue(),

    // Add here
    vueComponentOverride(),
  ],
});
```

Now start developing your Vue component library. The plugin will automatically inject the resolver when you build.

```ts
import Foo from '~myui/components/Foo.vue';

// Will be auto-convert
```

### Externalize

Important: Do not bundle `vite-plugin-vue-component-override` into your compiled component library. Bundling it can
cause duplicate-definition errors in projects that use the library.

By default the plugin is treated as external. If you customize Rollup/Vite's `external` option, make sure
`vite-plugin-vue-component-override` is included.

```js
// dist/some/file/you-compiled.js

// CORRECT: "vite-plugin-vue-component-override" should be externalized
import { resolveComponent as Q } from "vite-plugin-vue-component-override";

const i = Q("Component", zt), a = l, u = _();
```

If it's not externalized, add it to `vite.config.js`:

```js
export default defineConfig({
  // ...
  build: {
    rollupOptions: {
      external: [
        // Add this line if not exists
        'vite-plugin-vue-component-override'
      ]
    }
  }
});
```

## Usage: Overriding components in the App

The consuming app must install the package as well, but no configuration is required; you can import and use it
directly.

```bash
npm install vite-plugin-vue-component-override --save-dev

＃OR

yarn add vite-plugin-vue-component-override --dev
```

In your consuming project, to override a component, register the override globally before starting the Vue app:

```ts
import { overrideVueComponent } from 'vite-plugin-vue-component-override';

import CustomFoo from './overrides/CustomFoo.vue';

overrideVueComponent('~myui/components/Foo.vue', CustomFoo);

// Now start Vue App
createApp(App).mount('#app');
```

> [!important]
> Because of Vue's scoping, you cannot override a component for just one app. Overrides apply globally by the
> component's resolved import path.

### Async components

When a library loads a component with `defineAsyncComponent`, use `overrideVueAsyncComponent` to override it:

```ts
import { overrideVueAsyncComponent } from 'vite-plugin-vue-component-override';

import CustomFoo from './overrides/CustomFoo.vue';

overrideVueAsyncComponent('~myui/components/Foo.vue', CustomFoo);
// OR
overrideVueAsyncComponent('~myui/components/Foo.vue', Promise.resolve(CustomFoo));
// OR
overrideVueAsyncComponent('~myui/components/Foo.vue', import('./overrides/CustomFoo.vue'));
// OR
overrideVueAsyncComponent('~myui/components/Foo.vue', () => import('./overrides/CustomFoo.vue'));
```

Avoid mixing sync and async override methods. Vue decides how to load a component based on how it is defined.

Note that if a library imports the same component both synchronously and asynchronously, you must register the override
twice for it to take effect:

```ts
import { overrideVueComponent, overrideVueAsyncComponent } from 'vite-plugin-vue-component-override';

import CustomFoo from './overrides/CustomFoo.vue';

overrideVueComponent('~myui/components/Foo.vue', CustomFoo);
overrideVueAsyncComponent('~myui/components/Foo.vue', CustomFoo);
```

### Import Paths

By default, the override id is the component's import path. To avoid mismatches, prefer using absolute paths rather than
relative paths.

```ts
// GOOD
import Foo from '~myui/components/Foo.vue';

// Override
overrideVueComponent('~myui/components/Foo.vue', CustomFoo);

// ----

// BAD: But still works if you provide same path
import Foo from '../../components/Foo.vue';

// Override
overrideVueComponent('../../components/Foo.vue', CustomFoo);
```

### Alias

This plugin also provides `alias` so component IDs can be shorter. First, set up aliases in the library project:

```ts
import vueComponentOverride from 'vite-plugin-vue-component-override/plugin';

export default defineConfig({
  // ...
  plugins: [
    vue(),

    vueComponentOverride({
      alias: {
        'MyUIFoo': '~myui/components/Foo.vue',
        'MyUIBar': '~myui/components/Bar.vue',
      },

      // OR use functions

      alias: (id) => {
        if (id === '~myui/components/Foo.vue') {
          return 'MyUIFoo';
        }

        if (id === '~myui/components/Bar.vue') {
          return 'MyUIBar';
        }
      }
    }),
  ],
});
```

Then, in the consuming project, you can use the alias directly:

```ts
import { overrideVueComponent } from 'vite-plugin-vue-component-override';

import CustomFoo from './overrides/CustomFoo.vue';

overrideVueComponent('MyUIFoo', CustomFoo);
```

## Configuration

Available options:

```ts
export type AliasCallback = (id: string) => string | undefined | null;
export type ExcludeCallback = (code: string, id: string) => boolean | undefined | null;

export interface VueComponentOverrideOptions {
  /**
   * File extensions to be processed by the plugin
   */
  extensions?: string[]; // Default [js,ts,vue,jsx,tsx] (Don't include dot)
  /**
   * Whether to handle static imports (import Foo from '...')
   */
  handleStaticImports?: boolean; // Default true
  /**
   * Whether to handle dynamic imports (import('...'))
   */
  handleDynamicImports?: boolean; // Default true
  /**
   * Alias mapping for component IDs
   */
  alias?: Record<string, string> | AliasCallback;
  /**
   * Exclude certain files from being processed by the plugin
   */
  excludes?: string[] | string | RegExp[] | RegExp | ExcludeCallback;
}
```
