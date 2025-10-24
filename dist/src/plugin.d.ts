import { PluginOption } from 'vite';
export interface VueComponentOverrideOptions {
    extensions?: string[];
    handleStaticImports?: boolean;
    handleDynamicImports?: boolean;
    alias?: Record<string, string> | AliasCallback;
    excludes?: string[] | string | RegExp[] | RegExp | ExcludeCallback;
}
export type AliasCallback = (id: string) => string | undefined | null;
export type ExcludeCallback = (code: string, id: string) => boolean | undefined | null;
export default function vueComponentOverride(options?: VueComponentOverrideOptions): PluginOption;
