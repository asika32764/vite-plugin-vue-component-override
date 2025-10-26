import { getCurrentInstance } from "vue";
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
function resolveVueComponent(name, def) {
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
function toKebabCase(text) {
  return text.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
}
function toPascalCase(text) {
  return text.replace(/(^\w|-\w)/g, (t) => t.replace(/-/, "").toUpperCase());
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
