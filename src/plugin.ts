import MagicString from 'magic-string';
import { minimatch } from 'minimatch';
import { PluginOption } from 'vite';
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
  const uid = Math.random().toString(36).substring(2, 8);

  return [
    {
      name: 'vue-component-override',
      enforce: 'pre',
      transform(code, id) {
        const fileUri = new URL(id, 'file://');

        if (fileUri.pathname.endsWith('.vue')) {
          if (fileUri.searchParams.get('setup') !== 'true') {
            return null;
          }
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
        const resolveFuncName = `__VUE_COMPONENT_OVERRIDE_RESOLVE_${uid}__`;
        const resolveCodes: string[] = [];

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
            let replaced = `import ${tmpName} from '${uri}';`;
            resolveCodes.push(`const ${component} = ${resolveFuncName}('${component}', ${tmpName});`);

            shouldAddResolver = true;

            s.overwrite(start, end, replaced);
          }
        }

        if (handleDynamicImports) {
          const regex = /(const|let|var)\s+(.+)\s*=\s*defineAsyncComponent\(\(\)\s*=>\s*import\(\s*['"](.+?\.vue)['"]\s*\)\s*\);?/g;
          
          let matches: RegExpExecArray | null;
          while (matches = regex.exec(safeCode)) {
            let [match, sign, component, uri] = matches;

            component = component.trim();

            const start = matches.index;
            const end = start + match.length;

            const replaced = `${sign} ${component} = ${resolveFuncName}('${component}', defineAsyncComponent(() => import('${uri}')))`

            shouldAddResolver = true;

            s.overwrite(start, end, replaced);
          }
        }

        if (shouldAddResolver) {
          addImportToFile('resolveVueComponent', resolveFuncName, s, safeCode, id);
        }

        if (resolveCodes.length > 0) {
          addResolveToFile(resolveCodes, s, safeCode, id);
        }
        
        if (id.includes('Additional')) {
          console.log(s.toString());
        }
        
        return {
          code: s.toString(),
          map: s.generateMap({
            source: id,
            hires: true,
            includeContent: true
          }),
        };
      }
    }
  ];
};

function addImportToFile(importName: string, funcName: string, s: MagicString, code: string, id: string) {
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

function addResolveToFile(codes: string[], s: MagicString, code: string, id: string) {
  // Find `setup(...)` and append to top
    const setupMatch = code.match(/setup\s*\((.*?)\)\s*{?/);
    if (setupMatch) {
      const insertPos = setupMatch.index! + setupMatch[0].length;
      s.appendLeft(insertPos, `\n${codes.join('\n')}\n`);
    } else {
      s.prepend(`\n${codes.join('\n')}\n`);
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
