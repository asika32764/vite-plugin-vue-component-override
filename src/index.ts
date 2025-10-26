import { getCurrentInstance } from 'vue';

const registry: Record<string, any> = {};
const asyncRegistry: Record<string, Promise<any>> = {};

export function overrideVueComponent(id: string, component: any) {
  if (component == null) {
    return registry[id] ?? undefined;
  }

  if (component === false) {
    delete registry[id];
    return;
  }

  registry[id] = component;
}

export function overrideVueAsyncComponent(id: string, component: any) {
  if (component == null) {
    return asyncRegistry[id] ?? undefined;
  }

  if (component === false) {
    delete asyncRegistry[id];
    return;
  }

  if (typeof component === 'function') {
    component = component();
  }

  asyncRegistry[id] = Promise.resolve(component);
}

export function resolveVueComponent(name: string, def?: any): any | undefined {
  const inc = getCurrentInstance();
  console.log(inc);
  if (!inc) {
    return def;
  }
  console.log(inc.appContext.components);
  const components = inc.appContext.components;

  const found = components[name] || components[toPascalCase(name)] || components[toKebabCase(name)];

  return found ?? def;
}

function toKebabCase(text: string) {
  return text
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toPascalCase(text: string) {
  return text
    .replace(/(^\w|-\w)/g, (t) => t.replace(/-/, '').toUpperCase());
}

export function resolveVueAsyncComponent(id: string): Promise<any> | undefined {
  return asyncRegistry[id];
}

export { registry, asyncRegistry };

