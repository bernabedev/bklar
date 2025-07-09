import type { JWTPayload } from "jose";

declare module "bklar" {
  interface State {
    jwt: JWTPayload & { email: string };
  }
}
