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

import { resolveVueComponent } from 'vite-plugin-vue-component-override';
import Foo_Tmp45833 from '~myui/components/Foo.vue';

const Foo = resolveVueComponent('Foo', Foo_Tmp45833);
```

If the app using the library has overridden a component, `resolveVueComponent()` returns the overridden component; otherwise
it returns the original.

Then you can simply use `app.component('Foo', ...)` to override the component in the consuming app.

```ts
import { createApp } from '@vue/runtime-dom';
const app = createApp(MyApp);

// Override here
aoo.component('Foo', CustomFooComponent);

app.mount('#app');
```

The plugin also supports async imports.

```ts
const Foo = defineAsyncComponent(() => import('~myui/components/Foo.vue'));

// Convert to:

import { resolveVueAsyncComponent } from 'vite-plugin-vue-component-override';

const Foo = resolveVueAsyncComponent('Foo', defineAsyncComponent(() => import('~myui/components/Foo.vue')));
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

## Usage: Overriding components in the App

In your consuming project, override components before starting the Vue app:

```ts
import CustomFoo from './overrides/CustomFoo.vue';

const app = createApp(App);

app.component('Foo', CustomFoo);

app.mount('#app');
```

## Configuration

Available options:

```ts
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
   * Exclude components from being processed by the plugin
   */
  excludes?: string[] | string | RegExp[] | RegExp | ExcludeCallback;
}
```
