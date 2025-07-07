import type z from "zod";

export type Handler<P extends Record<string, string> = {}> = (
  req: Request,
  params: P
) => Promise<Response>;

export type Middleware<P = Record<string, string>> = (
  req: Request,
  params: P
) => Promise<Request> | Request;

export type Route<P extends Record<string, string>> = {
  method: string;
  segments: string[];
  handler: Handler<P>;
  middlewares: Middleware[];

  querySchema?: z.ZodSchema<any>;
};
