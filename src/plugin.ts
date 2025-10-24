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

  return [
    {
      name: 'vue-component-override',
      enforce: 'post',
      config(config) {
        if (typeof config.build?.rollupOptions?.external === 'function') {
          const originalExternal = config.build.rollupOptions.external;
          config.build.rollupOptions.external = (source, ...rest) => {
            if (source === pkg.name) {
              return true;
            }
            return originalExternal(source, ...rest);
          };
        } else {
          config = mergeConfig(config, {
            build: {
              rollupOptions: {
                external: [
                  pkg.name
                ]
              }
            }
          });
        }

        return config;
      },
      transform(code, id) {
        id = id.split('?')[0]; // Remove query parameters for matching

        if (!new RegExp(`\\.(${extensions.join('|')})$`).test(id)) {
          return null;
        }

        // Use the top-level helper to decide exclusion
        if (isExcluded(excludes, code, id)) {
          return null;
        }

        let { code: striped, comments } = stripComments(code);
        code = striped;

        let shouldAddResolver = false;
        let shouldAddAsyncResolver = false;

        if (handleStaticImports) {
          code = code.replaceAll(/import\s+(.*?)\s+from\s+['"]((.*?)\.vue)['"]\s*(;?)/g, (match, component, uri) => {
            if (component.includes('__Tmp')) {
              return match;
            }

            const alias = resolveAlias(aliasOption, uri);

            const tmpName = component + '__Tmp' + Math.floor(Math.random() * 100000);
            let replaced = `import ${tmpName} from '${uri}';\n
const ${component} = resolveComponent('${alias}', ${tmpName});`;

            shouldAddResolver = true;

            return replaced;
          });
        }

        if (handleDynamicImports) {
          code = code.replaceAll(/import\(\s*['"]((.*?)\.vue)['"]\s*\)/g, (match, uri) => {
            shouldAddAsyncResolver = true;
            const alias = resolveAlias(aliasOption, uri);
            return `resolveAsyncComponent('${alias}') ?? import(/* @vue-component-override */'${uri}')`;
          });
        }

        if (shouldAddResolver) {
          code = addResolverToFile('resolveComponent', code, id);
        }

        if (shouldAddAsyncResolver) {
          code = addResolverToFile('resolveAsyncComponent', code, id);
        }

        return {
          code: restoreComments(code, comments),
          map: null
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

function addResolverToFile(funcName: string, code: string, id: string) {
  // Use RegExp object
  if (!new RegExp(`{.*?${funcName}.*?}\s+from`).test(code)) {
    // Add import at file top but after vue <script*>
    if (id.endsWith('.vue')) {
      const vueScriptMatch = code.match(/<script(.*?)?>/);
      if (vueScriptMatch) {
        const insertPos = vueScriptMatch.index! + vueScriptMatch[0].length;
        code = code.slice(0, insertPos) + `\nimport { ${funcName} } from '${pkg.name}';` + code.slice(insertPos);
      }
    } else {
      code = `import { ${funcName} } from '${pkg.name}';\n` + code;
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

function stripComments(code: string): { code: string; comments: CommentPlaceholder[] } {
  const comments: CommentPlaceholder[] = [];
  let i = 0;

  code = code
    // Multi-line /* */
    .replace(/\/\*[\s\S]*?\*\//g, match => {
      const key = `__COMMENT_BLOCK_${i}__`;
      comments.push({ key, value: match });
      i++;
      return key;
    })
    // Single-line //
    .replace(/\/\/.*$/gm, match => {
      const key = `__COMMENT_LINE_${i}__`;
      comments.push({ key, value: match });
      i++;
      return key;
    });

  return { code, comments };
}

function restoreComments(code: string, comments: CommentPlaceholder[]): string {
  for (const { key, value } of comments) {
    const re = new RegExp(key, 'g');
    code = code.replace(re, value);
  }

  return code;
}
