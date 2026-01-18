import type { Context } from "./context";
import type { ValidatorAdapter } from "./validator";
import { type ServerWebSocket } from "bun";

// Generic Inference Helper
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

export type Handler<S extends Schemas = {}, ResponseType = any> = (
  ctx: InferContext<S>
) => ResponseType | Promise<ResponseType>;

export type Next = () => Promise<Response | void>;

export type Middleware = (
  ctx: Context<any>,
  next: Next
) => Promise<Response | void>;

export interface RouteDoc {
  summary?: string;
  description?: string;
  tags?: string[];
  responses?: Record<string, any>;
  security?: Array<Record<string, string[]>>;
}

export interface RouteOptions<S extends Schemas> {
  schemas?: S;
  middlewares?: Middleware[];
  doc?: RouteDoc;
  timeout?: number;
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
  idleTimeout?: number;
  logger?: boolean | Logger;
  errorHandler?: ErrorHandler;
  validator?: ValidatorAdapter;
  websocket?: {
    maxPayloadLength?: number;
    idleTimeout?: number;
    backpressureLimit?: number;
    closeOnBackpressureLimit?: boolean;
    publishToSelf?: boolean;
    perMessageDeflate?:
      | boolean
      | {
          compress?: boolean | "shared";
          decompress?: boolean | "shared";
        };
  };
}

export interface State {}

// Improved InferInput to check for valid schema shape instead of undefined
// This prevents 'Schemas' fallback from enforcing all keys
export type InferInput<S extends Schemas> = (S["query"] extends {
  _output: any;
}
  ? { query: Infer<S["query"]> }
  : {}) &
  (S["params"] extends { _output: any } ? { params: Infer<S["params"]> } : {}) &
  (S["body"] extends { _output: any } ? { body: Infer<S["body"]> } : {});

export interface WSData {
  ctx: Context<any>;
  _handlers: WSHandlers<WSData>;
}

export type WSContext<T = any> = ServerWebSocket<WSData>;

export interface WSHandlers<T = any> {
  open?: (ws: ServerWebSocket<T>) => void | Promise<void>;
  message?: (
    ws: ServerWebSocket<T>,
    message: string | Buffer
  ) => void | Promise<void>;
  close?: (
    ws: ServerWebSocket<T>,
    code: number,
    reason: string
  ) => void | Promise<void>;
  drain?: (ws: ServerWebSocket<T>) => void | Promise<void>;
}

export interface WSOptions<S extends Schemas>
  extends RouteOptions<S>,
    WSHandlers<WSData> {}

