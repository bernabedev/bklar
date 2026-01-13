import { Logger } from "./logger";

// Module Augmentation: Adds ctx.logger and ctx.reqId
declare module "bklar" {
  interface Context<T> {
    logger: Logger;
    reqId: string;
  }
}

export * from "./logger";
export * from "./middleware";
export * from "./types";
export * from "./formatters";
