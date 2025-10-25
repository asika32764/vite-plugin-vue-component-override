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

export function resolveVueComponent(id: string, def?: any): any | undefined {
  return registry[id] ?? def;
}

export function resolveVueAsyncComponent(id: string): Promise<any> | undefined {
  return asyncRegistry[id];
}

export { registry, asyncRegistry };

