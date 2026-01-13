import type { Middleware } from "bklar";

export interface CompressionOptions {
  /**
   * Minimum byte size to compress. Responses smaller than this will not be compressed.
   * @default 1024 (1KB)
   */
  threshold?: number;

  /**
   * Allowed encodings.
   * @default ["gzip", "deflate"]
   */
  encodings?: ("gzip" | "deflate")[];

  /**
   * Function to determine if a specific response should be compressed.
   * By default, checks if Content-Type matches text/*, application/json, etc.
   */
  filter?: (contentType: string) => boolean;
}

const DEFAULT_MIME_TYPES = [
  "text/",
  "application/json",
  "application/javascript",
  "application/xml",
  "application/x-yaml",
  "image/svg+xml",
];

const defaultFilter = (contentType: string): boolean => {
  if (!contentType) return false;
  return DEFAULT_MIME_TYPES.some((type) => contentType.includes(type));
};

export function compression(options: CompressionOptions = {}): Middleware {
  const threshold = options.threshold ?? 1024;
  const allowedEncodings = new Set(options.encodings ?? ["gzip", "deflate"]);
  const filter = options.filter ?? defaultFilter;

  return async (ctx, next) => {
    // 1. Check client support
    const acceptEncoding = ctx.req.headers.get("Accept-Encoding") || "";

    if (
      !acceptEncoding ||
      (!acceptEncoding.includes("gzip") && !acceptEncoding.includes("deflate"))
    ) {
      return next();
    }

    // 2. Execute downstream
    const res = await next();

    // 3. Resolve response object
    const response =
      res instanceof Response
        ? res
        : (ctx as any)._res instanceof Response
        ? (ctx as any)._res
        : null;

    if (!response || !response.body) return res;

    // 4. Skip if already compressed
    if (response.headers.has("Content-Encoding")) return response;

    // 5. Check Content-Type
    const contentType = response.headers.get("Content-Type");
    if (!contentType || !filter(contentType)) return response;

    // 6. Determine Encoding
    let encoding: "gzip" | "deflate" | null = null;
    if (allowedEncodings.has("gzip") && acceptEncoding.includes("gzip")) {
      encoding = "gzip";
    } else if (
      allowedEncodings.has("deflate") &&
      acceptEncoding.includes("deflate")
    ) {
      encoding = "deflate";
    }

    if (!encoding) return response;

    // 7. Read body (Buffer it)
    // NOTE: This action consumes the stream of the original response.
    // We CANNOT reuse 'response' after this point.
    const bodyBuffer = await response.arrayBuffer();

    // 8. Check Threshold
    if (bodyBuffer.byteLength < threshold) {
      // Fix: Create a NEW response with the read buffer, copying headers/status
      return new Response(bodyBuffer, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    // 9. Compress
    let compressedBody: Uint8Array;
    if (encoding === "gzip") {
      compressedBody = Bun.gzipSync(new Uint8Array(bodyBuffer));
    } else {
      compressedBody = Bun.deflateSync(new Uint8Array(bodyBuffer));
    }

    // 10. Construct new response
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Content-Encoding", encoding);
    newHeaders.set("Content-Length", compressedBody.byteLength.toString());
    newHeaders.set("Vary", "Accept-Encoding");
    newHeaders.delete("ETag"); // ETag is invalid after compression

    return new Response(compressedBody as unknown as BodyInit, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}
