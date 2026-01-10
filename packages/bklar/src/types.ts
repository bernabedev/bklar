import type { z } from "zod";
import type { Context } from "./context";

export type AnyZodObject = z.ZodObject<any, any, any, any, any>;

export interface Schemas {
  query?: AnyZodObject;
  params?: AnyZodObject;
  body?: AnyZodObject;
}

export type InferContext<S extends Schemas> = Context<{
  query: S["query"] extends AnyZodObject ? z.infer<S["query"]> : never;
  params: S["params"] extends AnyZodObject ? z.infer<S["params"]> : never;
  body: S["body"] extends AnyZodObject ? z.infer<S["body"]> : never;
}>;

export type Handler<S extends Schemas = {}> = (
  ctx: InferContext<S>
) => Response | Promise<Response>;

export type Next = () => Promise<Response>;

export type Middleware = (
  ctx: Context<any>,
  next: Next
) => Promise<Response>;

export interface RouteDoc {
  summary?: string;
  description?: string;
  tags?: string[];
  responses?: {
    [statusCode: string]: {
      description: string;
      content?: {
        [mimeType: string]: {
          schema: any;
        };
      };
    };
  };
  /**
   * Defines the security requirements for a specific operation.
   * An empty array `[]` indicates the endpoint is public, overriding any global security.
   * Example: `[{ bearerAuth: [] }]`
   * @see https://swagger.io/specification/#security-requirement-object
   */
  security?: Array<Record<string, string[]>>;
}

export interface RouteOptions<S extends Schemas> {
  schemas?: S;
  middlewares?: Middleware[];
  doc?: RouteDoc;
}

export interface Route<S extends Schemas> {
  method: string;
  segments: string[];
  handler: Handler<S>;
  options: RouteOptions<S>;
}

export class ValidationError extends Error {
  constructor(public details: object) {
    super("Validation failed");
    this.name = "ValidationError";
  }
}

export type Logger = (
  req: Request,
  time: number,
  status: number,
  ip?: string
) => void;

export type ErrorHandler = (
  error: unknown,
  ctx?: Context<any>
) => Response | Promise<Response>;

// A generic hook type. It can be async and can short-circuit the request
// by returning a Response object.
export type Hook = (
  ctx: Context<any>
) => void | Promise<void> | Response | Promise<Response>;

// A specific hook type for the onResponse event. It receives the final
// Response object and can inspect or log it, but not change it.
export type ResponseHook = (
  ctx: Context<any>,
  response: Response
) => void | Promise<void>;

// A specific hook type for the onError event. It receives the error
// for logging or monitoring purposes.
export type ErrorHook = (
  ctx: Context<any>,
  error: unknown
) => void | Promise<void>;

export interface BklarOptions {
  logger?: boolean | Logger;
  errorHandler?: ErrorHandler;
  onRequest?: Hook[];
  preParse?: Hook[];
  preValidation?: Hook[];
  preHandler?: Hook[];
  onResponse?: ResponseHook[];
  onError?: ErrorHook[];
}

export interface State {}
