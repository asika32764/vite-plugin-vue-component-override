declare const registry: Record<string, any>;
declare const asyncRegistry: Record<string, Promise<any>>;
export declare function overrideVueComponent(id: string, component: any): any;
export declare function overrideVueAsyncComponent(id: string, component: any): Promise<any> | undefined;
export declare function resolveVueComponent(id: string, def?: any): any | undefined;
export declare function resolveVueAsyncComponent(id: string): Promise<any> | undefined;
export { registry, asyncRegistry };
