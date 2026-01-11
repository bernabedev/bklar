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

// Handler can return Response or any JSON-serializable data
export type Handler<S extends Schemas = {}, ResponseType = any> = (
  ctx: InferContext<S>
) => ResponseType | Promise<ResponseType>;

export type Next = () => Promise<Response | void>;

export type Middleware = (
  ctx: Context<any>,
  next: Next
) => Promise<Response | void>;

export interface RouteOptions<S extends Schemas> {
  schemas?: S;
  middlewares?: Middleware[];
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

export interface State {}

// Helper types for Client RPC
export type InferInput<S extends Schemas> = {
    query: S["query"] extends AnyZodObject ? z.infer<S["query"]> : never;
    params: S["params"] extends AnyZodObject ? z.infer<S["params"]> : never;
    body: S["body"] extends AnyZodObject ? z.infer<S["body"]> : never;
};
