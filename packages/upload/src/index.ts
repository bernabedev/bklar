import type { Middleware } from "bklar";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

export interface UploadedFile {
  /** Original name of the file on the user's computer */
  originalName: string;
  /** The name of the file as saved on disk */
  filename: string;
  /** The full path to the saved file */
  path: string;
  /** MIME type of the file */
  type: string;
  /** Size in bytes */
  size: number;
}

export interface UploadOptions {
  /**
   * Destination directory to save files.
   * If not provided, files will NOT be saved to disk, but will remain as
   * native Bun `File` objects in `ctx.state.files`.
   */
  dest?: string;

  /**
   * Maximum file size in bytes.
   * @default Infinity
   */
  maxSize?: number;

  /**
   * Allowed MIME types (e.g., ["image/png", "image/jpeg"])
   * or a regex (e.g., /^image\//).
   * @default All types allowed
   */
  types?: string[] | RegExp;

  /**
   * If true, renames the file to a random UUID while keeping the extension.
   * @default true
   */
  randomize?: boolean;

  /**
   * Function to generate a custom filename. Overrides `randomize`.
   */
  filename?: (file: File) => string;
}

declare module "bklar" {
  interface State {
    /**
     * Files uploaded during the request.
     * If `dest` was provided in options, values are `UploadedFile` metadata objects.
     * If `dest` was NOT provided, values are native Bun `File` objects (in-memory/temp).
     */
    files?: Record<string, UploadedFile | File>;
  }
}

export function upload(options: UploadOptions = {}): Middleware {
  const {
    dest,
    maxSize = Infinity,
    types,
    randomize = true,
    filename: customFilename,
  } = options;

  // Ensure destination exists if provided
  if (dest) {
    fs.mkdir(dest, { recursive: true }).catch(() => {});
  }

  return async (ctx, next) => {
    const contentType = ctx.req.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return next();
    }

    let formData: FormData;
    try {
      formData = await ctx.req.formData();
    } catch (e) {
      return ctx.json({ message: "Invalid form data" }, 400);
    }

    const files: Record<string, UploadedFile | File> = {};
    const fields: Record<string, any> = {};

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        // --- Validation ---

        // 1. Size Check
        if (value.size > maxSize) {
          return ctx.json(
            { message: `File '${value.name}' exceeds size limit` },
            413
          );
        }

        // 2. Type Check
        if (types) {
          const fileType = value.type;
          let allowed = false;
          if (Array.isArray(types)) {
            allowed = types.includes(fileType);
          } else if (types instanceof RegExp) {
            allowed = types.test(fileType);
          }

          if (!allowed) {
            return ctx.json(
              { message: `File type '${fileType}' is not allowed` },
              415
            );
          }
        }

        // --- Processing ---
        if (dest) {
          // Save to Disk
          let fileName = value.name;

          if (customFilename) {
            fileName = customFilename(value);
          } else if (randomize) {
            const ext = path.extname(value.name);
            fileName = `${randomUUID()}${ext}`;
          }

          const savePath = path.join(dest, fileName);

          try {
            await Bun.write(savePath, value);

            files[key] = {
              originalName: value.name,
              filename: fileName,
              path: savePath,
              type: value.type,
              size: value.size,
            };
          } catch (err) {
            return ctx.json({ message: "File upload failed" }, 500);
          }
        } else {
          // Keep in Memory (Bun File)
          files[key] = value;
        }
      } else {
        // It's a regular text field
        fields[key] = value;
      }
    }

    // Populate Context
    // We augment ctx.body with non-file fields so Zod can validate them easily
    // We attach files to ctx.state.files for type-safe access
    ctx.body = fields;
    ctx.state.files = files;

    return next();
  };
}
