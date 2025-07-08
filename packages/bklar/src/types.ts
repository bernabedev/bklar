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

export type Middleware<S extends Schemas = {}> = (
  ctx: InferContext<S>
) => void | Response | Promise<void | Response>;

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
}

export interface RouteOptions<S extends Schemas> {
  schemas?: S;
  middlewares?: Middleware<S>[];
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

export interface BklarOptions {
  logger?: boolean | Logger;
  errorHandler?: ErrorHandler;
}
