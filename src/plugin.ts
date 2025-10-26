import MagicString from 'magic-string';
import { minimatch } from 'minimatch';
import { mergeConfig, PluginOption } from 'vite';
import pkg from '../package.json' with { type: 'json' };

export interface VueComponentOverrideOptions {
  extensions?: string[];
  handleStaticImports?: boolean;
  handleDynamicImports?: boolean;
  alias?: Record<string, string> | AliasCallback;
  excludes?: string[] | string | RegExp[] | RegExp | ExcludeCallback;
}

export type AliasCallback = (id: string) => string | undefined | null;
export type ExcludeCallback = (code: string, id: string) => boolean | undefined | null;

export default function vueComponentOverride(options: VueComponentOverrideOptions = {}): PluginOption {
  const extensions = options.extensions ?? ['js', 'ts', 'jsx', 'tsx', 'vue'];
  const handleStaticImports = options.handleStaticImports ?? true;
  const handleDynamicImports = options.handleDynamicImports ?? true;
  const excludes = options.excludes;
  const aliasOption = options.alias;
  const uid = Math.random().toString(36).substring(2, 8);

  return [
    {
      name: 'vue-component-override',
      enforce: 'pre',
      // config(config) {
      //   if (typeof config.build?.rollupOptions?.external === 'function') {
      //     const originalExternal = config.build.rollupOptions.external;
      //     config.build.rollupOptions.external = (source, ...rest) => {
      //       if (source === pkg.name) {
      //         return true;
      //       }
      //       return originalExternal(source, ...rest);
      //     };
      //   } else {
      //     config = mergeConfig(config, {
      //       build: {
      //         rollupOptions: {
      //           external: [
      //             pkg.name
      //           ]
      //         }
      //       }
      //     });
      //   }
      //
      //   return config;
      // },
      transform(code, id) {
        if (id.includes('?')) {
          return null;
        }

        if (id.includes('Additional')) {
          console.log(id);
        }

        if (!new RegExp(`\\.(${extensions.join('|')})$`).test(id)) {
          return null;
        }

        // Use the top-level helper to decide exclusion
        if (isExcluded(excludes, code, id)) {
          return null;
        }

        let safeCode = stripComments(code);

        let shouldAddResolver = false;
        let shouldAddAsyncResolver = false;
        const resolveFuncName = `__VUE_COMPONENT_OVERRIDE_RESOLVE_${uid}__`;
        const resolveAsyncFuncName = `__VUE_COMPONENT_OVERRIDE_ASYNC_RESOLVE_${uid}__`;

        const s = new MagicString(code);

        if (handleStaticImports) {
          const regex = /import\s+(.*?)\s+from\s+['"]((.*?)\.vue)['"]\s*(;?)/g;

          let matches: RegExpExecArray | null;

          while (matches = regex.exec(safeCode)) {
            const [match, component, uri] = matches;

            if (component.includes('__Tmp')) {
              continue;
            }

            const start = matches.index;
            const end = start + match.length;

            const tmpName = component + '__Tmp' + Math.floor(Math.random() * 100000);
            let replaced = `import ${tmpName} from '${uri}';\n
const ${component} = ${resolveFuncName}('${component}', ${tmpName});`;

            shouldAddResolver = true;

            s.overwrite(start, end, replaced);
          }
        }

        if (handleDynamicImports) {
          const regex = /(const|let|var)\s+(\w+)\s*=\s*defineAsyncComponent\(\s*\(\s*=>\s*import\(\s*['"]([^'"]+?\.vue)['"]\s*\)\s*\)\s*\)/g;

          let matches: RegExpExecArray | null;
          while (matches = regex.exec(safeCode)) {
            const [match, sign, component, uri] = matches;

            const start = matches.index;
            const end = start + match.length;

            const replaced = `${sign} ${component} = ${resolveFuncName}('${component}', defineAsyncComponent(() => import('${uri}')))`

            shouldAddAsyncResolver = true;

            s.overwrite(start, end, replaced);
          }
        }

        if (shouldAddResolver) {
          addResolverToFile('resolveVueComponent', resolveFuncName, s, safeCode, id);
        }

        if (shouldAddAsyncResolver) {
          addResolverToFile('resolveVueAsyncComponent', resolveAsyncFuncName, s, safeCode, id);
        }

        return {
          code: s.toString(),
          map: null,
          // map: s.generateMap({
          //   source: id,
          //   hires: true,
          //   includeContent: true
          // }),
        };
      }
    }
  ];
};

function resolveAlias(alias: VueComponentOverrideOptions['alias'], id: string): string {
  if (!alias) {
    return id;
  }

  if (typeof alias === 'function') {
    const result = alias(id);
    if (result) {
      return result;
    }
  } else {
    for (const [key, value] of Object.entries(alias)) {
      if (id.startsWith(key)) {
        return id.replace(key, value);
      }
    }
  }

  return id;
}

function addResolverToFile(importName: string, funcName: string, s: MagicString, code: string, id: string) {
  // Use RegExp object
  if (!new RegExp(`{.*?${funcName}.*?}\s+from`).test(code)) {
    const importLine = `import { ${importName} as ${funcName} } from '${pkg.name}';\n`

    // Add import at file top but after vue <script*>
    if (id.endsWith('.vue')) {
      const vueScriptMatch = code.match(/<script(.*?)?>/);
      if (vueScriptMatch) {
        const insertPos = vueScriptMatch.index! + vueScriptMatch[0].length;
        s.appendLeft(insertPos, `\n${importLine}`);
      } else {
        s.prepend(importLine);
      }
    } else {
      s.prepend(importLine);
    }
  }

  return code;
}

function isExcluded(
  excludes: VueComponentOverrideOptions['excludes'],
  code: string,
  id: string
): boolean {
  id = id.replace(/\\/g, '/'); // Normalize Windows paths

  if (!excludes) {
    return false;
  }

  if (typeof excludes === 'function') {
    try {
      return !!excludes(code, id);
    } catch (e) {
      // If the user-provided function throws, treat as not excluded
      return false;
    }
  }

  const excludeList = Array.isArray(excludes) ? excludes : [excludes as string | RegExp];

  for (const exclude of excludeList) {
    if (exclude instanceof RegExp) {
      if (exclude.test(id)) {
        return true;
      }
    } else {
      if (minimatch(id, exclude)) {
        return true;
      }
    }
  }

  return false;
}

type CommentPlaceholder = { key: string; value: string; };

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/\/\/.*$/gm, (m) => ' '.repeat(m.length))
}

function restoreComments(code: string, comments: CommentPlaceholder[]): string {
  for (const { key, value } of comments) {
    const re = new RegExp(key, 'g');
    code = code.replace(re, value);
  }

  return code;
}
