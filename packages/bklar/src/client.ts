import type { BklarApp } from "./app";

// Helper to strip leading slash
type StripSlash<T> = T extends `/${infer U}` ? U : T;

// Recursive type to split path string into nested object
type SplitPath<Path extends string, Methods> = Path extends `${infer Part}/${infer Rest}`
  ? { [K in Part]: SplitPath<Rest, Methods> }
  : { [K in Path]: Methods }; // Final segment

// Deep merge two objects
type DeepMerge<T, U> = T extends object
  ? U extends object
    ? {
        [K in keyof T | keyof U]: K extends keyof T
          ? K extends keyof U
            ? DeepMerge<T[K], U[K]>
            : T[K]
          : K extends keyof U
          ? U[K]
          : never;
      }
    : U
  : U;

// Convert flat Routes map to Nested Client
type RoutesToClient<Routes> = {
  [Path in keyof Routes]: SplitPath<StripSlash<Path & string>, {
     // For each method in this route, create a function
     [Method in keyof Routes[Path]]: Routes[Path][Method] extends { input: infer I, output: infer O }
       ? (args: I) => Promise<O>
       : never
  }>
}[keyof Routes]; 
// The above is a union of objects. We need to intersect/merge them. 
// UnionToIntersection is needed.

type UnionToIntersection<U> = 
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

type NestedClient<Routes> = UnionToIntersection<{
  [Path in keyof Routes]: SplitPath<StripSlash<Path & string>, {
      $url: string; // Internal marker or similar? No, the method is the key.
      [Method in keyof Routes[Path]]: Routes[Path][Method] extends { input: infer I, output: infer O }
       ? (args: I) => Promise<O>
       : never
  }>
}[keyof Routes]>;


// The runtime implementation
const createProxy = (baseUrl: string, path: string[] = []) => {
  return new Proxy(() => {}, {
    get(_target, prop) {
      if (typeof prop === "string") {
         // If it's a HTTP method
         if (['get', 'post', 'put', 'delete', 'patch'].includes(prop)) {
            // Return the fetcher function
            return async (args: any = {}) => {
                const method = prop.toUpperCase();
                let finalPath = path.join('/');
                if (!finalPath.startsWith('/')) finalPath = '/' + finalPath;
                
                // Replace params in path
                if (args.params) {
                    for (const [key, value] of Object.entries(args.params)) {
                        finalPath = finalPath.replace(`:${key}`, String(value));
                    }
                }

                const url = new URL(finalPath, baseUrl);
                
                // Append query
                if (args.query) {
                    for (const [key, value] of Object.entries(args.query)) {
                        url.searchParams.append(key, String(value));
                    }
                }

                const fetchOptions: RequestInit = {
                    method,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };

                if (args.body) {
                    fetchOptions.body = JSON.stringify(args.body);
                }

                const res = await fetch(url.toString(), fetchOptions);
                
                // Handle void response or JSON
                const text = await res.text();
                try {
                    return JSON.parse(text);
                } catch {
                    return text; // Return text if not JSON? Or undefined?
                }
            };
         }
         // Otherwise, it's a path segment
         return createProxy(baseUrl, [...path, prop]);
      }
      return undefined;
    }
  });
};

export function bklarClient<App extends BklarApp<any>>(baseUrl: string) {
    type Routes = App extends BklarApp<infer R> ? R : never;
    // We need to construct the nested type. 
    // This is a complex mapped type. 
    
    // Simplification for v2 prototype:
    // We will just cast the proxy to the inferred nested type.
    
    return createProxy(baseUrl) as NestedClient<Routes>;
}
