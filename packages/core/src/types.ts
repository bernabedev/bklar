import type { z } from "zod";
import type { Context } from "./context";

export type AnyZodObject = z.ZodObject<any, any, any, any, any>;

export interface RouteSchemas {
  query?: AnyZodObject;
  params?: AnyZodObject;
  body?: AnyZodObject;
}

export type InferContext<S extends RouteSchemas> = Context<{
  query: S["query"] extends AnyZodObject ? z.infer<S["query"]> : never;
  params: S["params"] extends AnyZodObject ? z.infer<S["params"]> : never;
  body: S["body"] extends AnyZodObject ? z.infer<S["body"]> : never;
}>;

export type Handler<S extends RouteSchemas = {}> = (
  ctx: InferContext<S>
) => Response | Promise<Response>;

export type Middleware<S extends RouteSchemas = {}> = (
  ctx: InferContext<S>
) => void | Promise<void>;

export interface RouteOptions<S extends RouteSchemas> {
  schemas?: S;
  middlewares?: Middleware<S>[];
  handler: Handler<S>;
}

export interface Route<S extends RouteSchemas> {
  method: string;
  segments: string[];
  options: RouteOptions<S>;
}

export class ValidationError extends Error {
  constructor(public details: object) {
    super("Validation failed");
    this.name = "ValidationError";
  }
}
