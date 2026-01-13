import { describe, expect, it, afterEach } from "bun:test";
import { Bklar } from "bklar";
import { upload } from "../src/index";
import fs from "node:fs/promises";
import path from "node:path";

const TEST_UPLOAD_DIR = path.join(import.meta.dir, "test-uploads");

describe("Upload Middleware", () => {
  afterEach(async () => {
    await fs
      .rm(TEST_UPLOAD_DIR, { recursive: true, force: true })
      .catch(() => {});
  });

  it("should upload a file and save to disk", async () => {
    const app = Bklar({ logger: false });

    app.post(
      "/upload",
      (ctx) => {
        return ctx.json({
          file: ctx.state.files?.testFile,
          body: ctx.body,
        });
      },
      {
        middlewares: [upload({ dest: TEST_UPLOAD_DIR })],
      }
    );

    const formData = new FormData();
    formData.append("username", "john");

    // Create a dummy file
    const file = new File(["content"], "test.txt", { type: "text/plain" });
    formData.append("testFile", file);

    const res = await app.request("/upload", {
      method: "POST",
      body: formData,
    });

    const body = await res.json();

    expect(res.status).toBe(200);

    // Check Body Parsing
    expect(body.body.username).toBe("john");

    // Check File Metadata
    expect(body.file).toBeDefined();
    expect(body.file.originalName).toBe("test.txt");
    expect(body.file.size).toBe(7); // "content" length

    // Check File on Disk
    const savedPath = body.file.path;
    const exists = await fs.exists(savedPath);
    expect(exists).toBe(true);

    const content = await fs.readFile(savedPath, "utf-8");
    expect(content).toBe("content");
  });

  it("should validate file size", async () => {
    const app = Bklar({ logger: false });

    app.post("/upload", () => ({}), {
      middlewares: [upload({ maxSize: 5 })], // Max 5 bytes
    });

    const formData = new FormData();
    const file = new File(["too large"], "large.txt"); // 9 bytes
    formData.append("file", file);

    const res = await app.request("/upload", {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(413);
  });

  it("should validate mime types", async () => {
    const app = Bklar({ logger: false });

    app.post("/upload", () => ({}), {
      middlewares: [upload({ types: ["image/png"] })],
    });

    const formData = new FormData();
    const file = new File(["fake image"], "image.jpg", { type: "image/jpeg" }); // Wrong type
    formData.append("file", file);

    const res = await app.request("/upload", {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(415);
  });

  it("should keep files in memory (Bun.File) if dest is missing", async () => {
    const app = Bklar({ logger: false });

    app.post(
      "/upload",
      async (ctx) => {
        const file = ctx.state.files?.memFile;
        let content = "";

        if (file instanceof File) {
          content = await file.text();
        }

        return ctx.json({
          isFile: file instanceof File,
          content,
        });
      },
      {
        middlewares: [upload()],
      }
    );

    const formData = new FormData();
    formData.append("memFile", new File(["memory"], "mem.txt"));

    const res = await app.request("/upload", {
      method: "POST",
      body: formData,
    });

    const body = await res.json();
    expect(body.isFile).toBe(true);
    expect(body.content).toBe("memory");
  });
});
