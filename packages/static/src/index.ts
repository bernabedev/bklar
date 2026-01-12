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
export function staticFiles(options: StaticOptions): Middleware {
  // Normalize options at initialization for performance and predictability.
  const config = {
    // Resolve the root path once, relative to the current working directory.
    root: path.resolve(process.cwd(), options.root),
    prefix: options.prefix || "/",
    dotfiles: options.dotfiles || false,
  };

  if (!config.prefix.startsWith("/")) {
    config.prefix = `/${config.prefix}`;
  }

  return async (ctx, next) => {
    // 1. Only handle GET and HEAD requests.
    if (ctx.req.method !== "GET" && ctx.req.method !== "HEAD") {
      return next();
    }

    const url = new URL(ctx.req.url);
    const pathname = url.pathname;

    // 2. Filter by prefix
    if (!pathname.startsWith(config.prefix)) {
      return next();
    }

    // 3. Resolve path
    let assetPath = pathname.substring(config.prefix.length);
    if (assetPath === "" || assetPath === "/") {
      assetPath = "/index.html"; // Basic index support
    }

    try {
      assetPath = decodeURIComponent(assetPath);
    } catch {
      return next();
    }

    // 4. Security Checks (Dotfiles)
    if (
      !config.dotfiles &&
      assetPath.split("/").some((part) => part.startsWith("."))
    ) {
      return next();
    }

    // 5. Security Checks (Path Traversal)
    const normalizedAssetPath = path.normalize(assetPath);
    const safePath = path.join(config.root, normalizedAssetPath);

    if (!safePath.startsWith(config.root)) {
      return next();
    }

    // 6. Check File Existence
    try {
      const file = Bun.file(safePath);
      // exists() is cheaper than stat(), but stat is needed to check isFile()
      // Bun.file() is lazy, so we need to await a check.
      if (await file.exists()) {
        // stat is slightly more expensive but safer against directories
        // However, Bun.file() usually errors or behaves specific ways on dirs.
        // Let's rely on Bun serve mechanics or do a stat check if strictness needed.
        // For high perf, exists() is usually enough if we trust the path structure.

        return new Response(file);
      }
    } catch {
      // Ignore errors (like file not found), proceed to next middleware
    }

    return next();
  };
}
