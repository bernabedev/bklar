import { Context } from "./context";
import {
  defaultErrorHandler,
  ErrorType,
  HttpError,
  NotFoundError,
} from "./errors";
import type {
  ErrorHandler,
  ErrorHook,
  Handler,
  Hook,
  Middleware,
  ResponseHook,
  Route,
  RouteOptions,
  Schemas,
} from "./types";
import { ValidationError } from "./types";

interface RouterOptions {
  errorHandler?: ErrorHandler;
  hooks?: {
    onRequest?: Hook[];
    preParse?: Hook[];
    preValidation?: Hook[];
    preHandler?: Hook[];
    onResponse?: ResponseHook[];
    onError?: ErrorHook[];
  };
}

export class Router {
  private routes: Route<any>[] = [];
  private globalMiddlewares: Middleware[] = [];
  private readonly errorHandler: ErrorHandler;
  private readonly hooks: Required<NonNullable<RouterOptions["hooks"]>>;

  constructor(options: RouterOptions = {}) {
    this.errorHandler = options.errorHandler || defaultErrorHandler;
    this.hooks = {
      onRequest: options.hooks?.onRequest || [],
      preParse: options.hooks?.preParse || [],
      preValidation: options.hooks?.preValidation || [],
      preHandler: options.hooks?.preHandler || [],
      onResponse: options.hooks?.onResponse || [],
      onError: options.hooks?.onError || [],
    };
  }

  use(middleware: Middleware) {
    this.globalMiddlewares.push(middleware);
  }

  add<S extends Schemas>(
    method: string,
    pattern: string,
    handler: Handler<S>,
    options: RouteOptions<S> = {}
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
  ): Promise<Response | void> {
    for (const mw of middlewares) {
      const result = await mw(ctx);
      if (result instanceof Response) {
        return result;
      }
    }
  }

  private async executeHooks(
    ctx: Context<any>,
    hooks: Hook[]
  ): Promise<Response | void> {
    for (const hook of hooks) {
      const result = await hook(ctx);
      if (result instanceof Response) {
        return result;
      }
    }
  }

  private async executeResponseHooks(
    ctx: Context<any>,
    response: Response,
    hooks: ResponseHook[]
  ) {
    for (const hook of hooks) {
      await hook(ctx, response);
    }
  }

  private async executeErrorHooks(
    ctx: Context<any>,
    error: unknown,
    hooks: ErrorHook[]
  ) {
    for (const hook of hooks) {
      await hook(ctx, error);
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

  private async _findAndExecuteRoute(ctx: Context<any>): Promise<Response> {
    const url = new URL(ctx.req.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);

    for (const route of this.routes) {
      if (route.method !== ctx.req.method && route.method !== "*") continue;
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

      ctx.params = params;

      // Execute route-specific middlewares (which are also hooks)
      if (route.options.middlewares) {
        const shortCircuitResponse = await this.executeHooks(
          ctx,
          route.options.middlewares
        );
        if (shortCircuitResponse) return shortCircuitResponse;
      }

      // --- preValidation Hook ---
      let shortCircuitResponse = await this.executeHooks(
        ctx,
        this.hooks.preValidation
      );
      if (shortCircuitResponse) return shortCircuitResponse;

      if (route.options.schemas) {
        await this.validate(ctx, route.options.schemas);
      }

      // --- preHandler Hook ---
      shortCircuitResponse = await this.executeHooks(
        ctx,
        this.hooks.preHandler
      );
      if (shortCircuitResponse) return shortCircuitResponse;

      return await route.handler(ctx);
    }

    throw new NotFoundError();
  }

  async handle(req: Request): Promise<Response> {
    const ctx = new Context(req, {});
    let response: Response;

    try {
      // --- onRequest Hook ---
      let shortCircuitResponse = await this.executeHooks(
        ctx,
        this.hooks.onRequest
      );
      if (shortCircuitResponse) return shortCircuitResponse;

      // --- preParse Hook ---
      shortCircuitResponse = await this.executeHooks(ctx, this.hooks.preParse);
      if (shortCircuitResponse) return shortCircuitResponse;

      ctx.query = Object.fromEntries(new URL(req.url).searchParams.entries());

      response = await this._findAndExecuteRoute(ctx);
    } catch (error) {
      // --- onError Hook ---
      await this.executeErrorHooks(ctx, error, this.hooks.onError);

      if (error instanceof ValidationError) {
        const validationError = new HttpError(
          ErrorType.VALIDATION,
          "Validation Error",
          error.details
        );
        response = await this.errorHandler(validationError, ctx);
      } else {
        response = await this.errorHandler(error, ctx);
      }
    }

    // --- onResponse Hook ---
    await this.executeResponseHooks(ctx, response, this.hooks.onResponse);

    // Final post-processing
    if (ctx.state.corsHeaders instanceof Headers) {
      // @ts-expect-error Headers is not iterable
      for (const [key, value] of ctx.state.corsHeaders.entries()) {
        response.headers.append(key, value);
      }
    }
    if (ctx.state.rateLimitHeaders) {
      for (const [key, value] of Object.entries(ctx.state.rateLimitHeaders)) {
        response.headers.set(key, String(value));
      }
    }

    return response;
  }

  public getRoutes(): Route<any>[] {
    return this.routes;
  }
}
