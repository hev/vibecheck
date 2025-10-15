declare module 'js-yaml' {
  export function load(str: string, options?: any): any;
  export function loadAll(str: string, iterator?: (doc: any) => void, options?: any): any;
  export function dump(obj: any, options?: any): string;
  export function dumpAll(documents: any[], options?: any): string;
  export function safeLoad(str: string, options?: any): any;
  export function safeLoadAll(str: string, iterator?: (doc: any) => void, options?: any): any;
  export function safeDump(obj: any, options?: any): string;
  export function safeDumpAll(documents: any[], options?: any): string;
}