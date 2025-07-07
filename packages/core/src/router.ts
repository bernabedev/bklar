import type z from "zod";
import type { Handler, Middleware, Route } from "./types";

export class Router {
  private routes: Route<any>[] = [];
  private globalMiddlewares: Middleware[] = [];

  use(middleware: Middleware): void {
    this.globalMiddlewares.push(middleware);
  }

  add<P extends Record<string, string>>(
    method: string,
    pattern: string,
    handler: Handler<P>,
    middlewares: Middleware[] = [],
    { querySchema }: { querySchema?: z.ZodSchema<any> } = {}
  ) {
    const segments = pattern.split("/").filter(Boolean);
    this.routes.push({ method, segments, handler, middlewares, querySchema });
  }

  group(
    prefix: string,
    builder: (router: Router) => void,
    middlewares: Middleware[] = []
  ) {
    const sub = new Router();
    builder(sub);
    const prefixSeg = prefix.split("/").filter(Boolean);
    sub.routes.forEach((r) =>
      this.routes.push({
        method: r.method,
        segments: [...prefixSeg, ...r.segments],
        handler: r.handler,
        middlewares: [...middlewares, ...r.middlewares],
        querySchema: r.querySchema,
      })
    );
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pathSeg = url.pathname.split("/").filter(Boolean);

    for (const { method, segments, handler, middlewares, querySchema } of this
      .routes) {
      if (method !== req.method && method !== "*") continue;
      if (segments.length !== pathSeg.length) continue;

      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < segments.length; i++) {
        if (segments[i]?.startsWith(":")) {
          // @ts-ignore
          params[segments[i]?.slice(1)] = pathSeg[i];
        } else if (segments[i] !== pathSeg[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      let queryParams: Record<string, any> = {};

      if (querySchema) {
        const rawQueryParams = Object.fromEntries(url.searchParams.entries());

        const validationResult = querySchema.safeParse(rawQueryParams);

        if (!validationResult.success) {
          return new Response(
            JSON.stringify({
              message: "Invalid query parameters",
              errors: validationResult.error.flatten().fieldErrors,
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        queryParams = validationResult.data;
      }

      const combinedParams = { ...params, ...queryParams };

      let reqToPass: Request = req;

      for (const mw of this.globalMiddlewares) {
        reqToPass = await mw(reqToPass, combinedParams);
      }
      for (const mw of middlewares) {
        reqToPass = await mw(reqToPass, combinedParams);
      }

      return handler(reqToPass, combinedParams);
    }

    return new Response(JSON.stringify({ message: "Route not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}
