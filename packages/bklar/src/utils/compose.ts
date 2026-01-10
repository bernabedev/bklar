import type { Context } from "../context";
import type { Middleware, Next } from "../types";

export function compose(middleware: Middleware[]) {
  if (!Array.isArray(middleware))
    throw new TypeError("Middleware stack must be an array!");
  for (const fn of middleware) {
    if (typeof fn !== "function")
      throw new TypeError("Middleware must be composed of functions!");
  }

  return function (ctx: Context<any>, next?: Next): Promise<Response> {
    // last called middleware #
    let index = -1;
    return dispatch(0);

    function dispatch(i: number): Promise<Response> {
      if (i <= index)
        return Promise.reject(new Error("next() called multiple times"));
      index = i;
      let fn = middleware[i];
      if (i === middleware.length) fn = next as any;
      
      // If we ran out of middlewares and no next handler is provided
      if (!fn) return Promise.resolve(new Response("Not Found", { status: 404 }));

      try {
        // Compatibility for legacy hooks (arity < 2)
        // If the function accepts 0 or 1 argument, we treat it as a hook:
        // await hook(ctx), then automatically call next().
        // Unless it returns a Response (short-circuit).
        if (fn.length < 2) {
             return Promise.resolve((fn as any)(ctx)).then((res: any) => {
                 if (res instanceof Response) return res;
                 return dispatch(i + 1);
             });
        }

        return Promise.resolve(fn(ctx, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }
  };
}
