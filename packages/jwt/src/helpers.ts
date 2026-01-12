import { SignJWT, decodeJwt, jwtVerify, type JWTPayload } from "jose";

export interface SignOptions {
  expiresIn?: string | number; // e.g., "2h", "7d", or seconds
}

/**
 * Signs a payload and returns a JWT.
 * @param payload The payload to sign.
 * @param secret The secret key.
 * @param alg The algorithm to use (default: "HS256").
 * @param options Signing options like expiresIn.
 * @returns The generated JWT.
 */
export async function sign(
  payload: JWTPayload,
  secret: string | Uint8Array,
  alg: string = "HS256",
  options?: SignOptions
): Promise<string> {
  const secretKey =
    typeof secret === "string" ? new TextEncoder().encode(secret) : secret;
  const jwtBuilder = new SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt();

  if (options?.expiresIn) {
    jwtBuilder.setExpirationTime(options.expiresIn);
  }

  return jwtBuilder.sign(secretKey);
}

/**
 * Verifies a JWT and returns its payload.
 * @param token The JWT to verify.
 * @param secret The secret key.
 * @param algorithms Allowed algorithms for verification.
 * @returns The JWT payload if verification is successful.
 * @throws {errors.JWTExpired} If the token has expired.
 * @throws {errors.JOSEError} For other verification failures.
 */
export async function verify<T extends JWTPayload = JWTPayload>(
  token: string,
  secret: string | Uint8Array,
  algorithms?: string[]
): Promise<T> {
  const secretKey =
    typeof secret === "string" ? new TextEncoder().encode(secret) : secret;
  const { payload } = await jwtVerify(token, secretKey, { algorithms });
  return payload as T;
}

/**
 * Decodes a JWT and returns its payload without verifying the signature.
 * **Warning:** Only use this if you have already verified the token or trust its source.
 * @param token The JWT to decode.
 * @returns The decoded payload.
 */
export function decode<T extends JWTPayload = JWTPayload>(token: string): T {
  return decodeJwt(token) as T;
}
