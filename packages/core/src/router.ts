import { Context } from "./context";
import type {
  Handler,
  Middleware,
  Route,
  RouteOptions,
  Schemas,
} from "./types";
import { ValidationError } from "./types";

export class Router {
  private routes: Route<any>[] = [];
  private globalMiddlewares: Middleware[] = [];

  use(middleware: Middleware) {
    this.globalMiddlewares.push(middleware);
  }

  add<S extends Schemas>(
    method: string,
    pattern: string,
    handler: Handler<S>,
    options: RouteOptions<S> = {} // options es un objeto opcional
  ) {
    const segments = pattern.split("/").filter(Boolean);
    this.routes.push({ method, segments, handler, options });
    return this;
  }

  get<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    return this.add("GET", path, handler, options);
  }
  post<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    return this.add("POST", path, handler, options);
  }
  put<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    return this.add("PUT", path, handler, options);
  }
  delete<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    return this.add("DELETE", path, handler, options);
  }
  patch<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    return this.add("PATCH", path, handler, options);
  }

  group(
    prefix: string,
    builder: (router: this) => void,
    middlewares: Middleware[] = []
  ) {
    const prefixSegments = prefix.split("/").filter(Boolean);
    const originalRoutesCount = this.routes.length;

    builder(this);

    for (let i = originalRoutesCount; i < this.routes.length; i++) {
      const route = this.routes[i];
      route.segments = [...prefixSegments, ...route.segments];
      route.options.middlewares = [
        ...middlewares,
        ...(route.options.middlewares || []),
      ];
    }

    return this;
  }

  private async executeMiddlewares(
    ctx: Context<any>,
    middlewares: Middleware[]
  ) {
    for (const mw of middlewares) {
      await mw(ctx);
    }
  }

  private async validate(ctx: Context<any>, schemas: Schemas | undefined) {
    if (!schemas) return;

    await ctx.parseBody();

    const results = {
      query: schemas.query?.safeParse(ctx.query),
      params: schemas.params?.safeParse(ctx.params),
      body: schemas.body?.safeParse(ctx.body),
    };

    const errors: Record<string, any> = {};
    let hasError = false;

    for (const [key, result] of Object.entries(results)) {
      if (result && !result.success) {
        hasError = true;
        errors[key] = result.error.flatten().fieldErrors;
      } else if (result?.success) {
        (ctx as any)[key] = result.data;
      }
    }

    if (hasError) {
      throw new ValidationError(errors);
    }
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);

    for (const route of this.routes) {
      if (route.method !== req.method && route.method !== "*") continue;
      if (route.segments.length !== pathSegments.length) continue;

      const params: Record<string, string> = {};
      let isMatch = true;

      for (let i = 0; i < route.segments.length; i++) {
        const routeSegment = route.segments[i];
        const pathSegment = pathSegments[i];
        if (routeSegment.startsWith(":")) {
          params[routeSegment.slice(1)] = pathSegment;
        } else if (routeSegment !== pathSegment) {
          isMatch = false;
          break;
        }
      }
      if (!isMatch) continue;

      const ctx = new Context(req, params);
      try {
        ctx.query = Object.fromEntries(url.searchParams.entries());

        if (route.options.schemas) {
          await this.validate(ctx, route.options.schemas);
        }

        await this.executeMiddlewares(ctx, this.globalMiddlewares);
        if (route.options.middlewares) {
          await this.executeMiddlewares(ctx, route.options.middlewares);
        }

        return await route.handler(ctx);
      } catch (error) {
        if (error instanceof ValidationError) {
          return ctx.json(
            { message: "Validation Error", errors: error.details },
            400
          );
        }
        if (error instanceof Response) {
          return error;
        }
        console.error("Unhandled Error:", error);
        return ctx.json({ message: "Internal Server Error" }, 500);
      }
    }

    return new Response(JSON.stringify({ message: "Route not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}
