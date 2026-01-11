import type { Context } from "../context";
import type { Middleware, Next } from "../types";

export function compose(middleware: Middleware[]) {
  if (!Array.isArray(middleware))
    throw new TypeError("Middleware stack must be an array!");
  for (const fn of middleware) {
    if (typeof fn !== "function")
      throw new TypeError("Middleware must be composed of functions!");
  }

  return function (context: Context<any>, next?: Next) {
    // last called middleware #
    let index = -1;
    return dispatch(0);

    function dispatch(i: number): Promise<Response | void> {
      if (i <= index)
        return Promise.reject(new Error("next() called multiple times"));
      index = i;
      let fn = middleware[i];
      
      if (i === middleware.length) {
          if (next) return next();
          return Promise.resolve();
      }
      
      if (!fn) return Promise.resolve();

      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }
  };
}
