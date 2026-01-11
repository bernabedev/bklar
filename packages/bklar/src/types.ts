import type { Context } from "./context";
import type { ValidatorAdapter } from "./validator";

// Generic Inference Helper
// Supports Zod (via _output) and others can be added or default to any
export type Infer<T> = T extends { _output: infer O } ? O : any;

export interface Schemas<T = any> {
  query?: T;
  params?: T;
  body?: T;
}

export type InferContext<S extends Schemas> = Context<{
  query: S["query"] extends undefined ? never : Infer<S["query"]>;
  params: S["params"] extends undefined ? never : Infer<S["params"]>;
  body: S["body"] extends undefined ? never : Infer<S["body"]>;
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
  validator?: ValidatorAdapter;
}

export interface State {}

// Helper types for Client RPC
export type InferInput<S extends Schemas> = {
    query: S["query"] extends undefined ? never : Infer<S["query"]>;
    params: S["params"] extends undefined ? never : Infer<S["params"]>;
    body: S["body"] extends undefined ? never : Infer<S["body"]>;
};
