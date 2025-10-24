declare const registry: Record<string, any>;
declare const asyncRegistry: Record<string, Promise<any>>;
export declare function overrideVueComponent(id: string, component: any): any;
export declare function overrideVueAsyncComponent(id: string, component: any): Promise<any> | undefined;
export declare function resolveComponent(id: string, def: any): any;
export declare function resolveAsyncComponent(id: string): Promise<any>;
export { registry, asyncRegistry };
