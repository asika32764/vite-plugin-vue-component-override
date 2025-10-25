const registry = {};
const asyncRegistry = {};
function overrideVueComponent(id, component) {
  if (component == null) {
    return registry[id] ?? void 0;
  }
  if (component === false) {
    delete registry[id];
    return;
  }
  registry[id] = component;
}
function overrideVueAsyncComponent(id, component) {
  if (component == null) {
    return asyncRegistry[id] ?? void 0;
  }
  if (component === false) {
    delete asyncRegistry[id];
    return;
  }
  if (typeof component === "function") {
    component = component();
  }
  asyncRegistry[id] = Promise.resolve(component);
}
function resolveVueComponent(id, def) {
  return registry[id] ?? def;
}
function resolveVueAsyncComponent(id) {
  return asyncRegistry[id];
}
export {
  asyncRegistry,
  overrideVueAsyncComponent,
  overrideVueComponent,
  registry,
  resolveVueAsyncComponent,
  resolveVueComponent
};
//# sourceMappingURL=index.js.map
