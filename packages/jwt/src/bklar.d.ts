import type { JWTPayload as JoseJWTPayload } from "jose";

declare module "bklar" {
  interface Context<T> {
    state: {
      jwt?: JoseJWTPayload;
      [key: string]: any;
    };
  }
}
