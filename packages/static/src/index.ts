import type { Middleware } from "bklar";
import path from "node:path";

export interface StaticOptions {
  /**
   * The root directory from which to serve static assets.
   * e.g., 'public'
   */
  root: string;

  /**
   * An optional URL prefix. Requests starting with this prefix
   * will be mapped to the `root` directory.
   * e.g., if prefix is '/assets', a request to '/assets/styles.css'
   * will serve the file at '<root>/styles.css'.
   * @default "/"
   */
  prefix?: string;

  /**
   * By default, files starting with a dot (e.g., `.env`) are not served.
   * Set this to `true` to allow serving them.
   * @default false
   */
  dotfiles?: boolean;
}

/**
 * Creates a middleware for serving static files from a directory.
 * @param options Configuration for the static middleware.
 * @returns A bklar Middleware function.
 */
export function staticServer(options: StaticOptions): Middleware {
  // --- Renamed to `Bklar` for API consistency across the ecosystem.

  // Normalize options at initialization for performance and predictability.
  const config = {
    // Resolve the root path once, relative to the current working directory.
    // This ensures that paths like './public' work as expected from the project root.
    root: path.resolve(process.cwd(), options.root),
    prefix: options.prefix || "/",
    dotfiles: options.dotfiles || false,
  };

  if (!config.prefix.startsWith("/")) {
    config.prefix = `/${config.prefix}`;
  }

  const staticMiddleware: Middleware = async (ctx) => {
    // Only handle GET and HEAD requests for static files.
    if (ctx.req.method !== "GET" && ctx.req.method !== "HEAD") {
      return;
    }

    const url = new URL(ctx.req.url);
    let pathname = url.pathname;

    // Only handle requests that match the configured prefix.
    if (!pathname.startsWith(config.prefix)) {
      return; // Not a static file request, continue to the next middleware or handler.
    }

    // Remove the prefix to get the relative file path.
    let assetPath = pathname.substring(config.prefix.length);

    // Security: Decode URI to handle encoded characters (e.g., %20 for spaces).
    // A try-catch block prevents server crashes from malformed URIs.
    try {
      assetPath = decodeURIComponent(assetPath);
    } catch (e) {
      // Invalid URI, ignore the request.
      return;
    }

    // Security: Prevent serving dotfiles by default.
    if (
      !config.dotfiles &&
      assetPath.split("/").some((part) => part.startsWith("."))
    ) {
      return;
    }

    // Security: Normalize the path to resolve '..' segments and prevent traversal attacks.
    const normalizedAssetPath = path.normalize(assetPath);
    const safePath = path.join(config.root, normalizedAssetPath);

    // Security: Final and most important check. Ensure the resolved path is still
    // within the intended root directory. This definitively prevents directory traversal.
    if (!safePath.startsWith(config.root)) {
      return;
    }

    try {
      const file = Bun.file(safePath);
      const stats = await file.stat();

      // --- IMPROVEMENT: Ensure it's a file, not a directory. ---
      if (stats.isFile()) {
        // If the file exists, return a Response with the Bun.File object.
        // Bun handles Content-Type, ETag, and Last-Modified headers automatically.
        // This is extremely fast and memory-efficient.
        return new Response(file);
      }
    } catch (error) {
      // This catch block handles errors from fs.stat (e.g., file not found).
      // We do nothing here, allowing the request to fall through to bklar's 404 handler.
    }

    // If the path is a directory or does not exist, do nothing and let
    // bklar's router handle it, likely resulting in a 404.
    return;
  };

  return staticMiddleware;
}
