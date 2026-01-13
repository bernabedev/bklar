# @bklarjs/upload 📁

[![NPM Version](https://img.shields.io/npm/v/@bklarjs/upload.svg)](https://www.npmjs.com/package/@bklarjs/upload)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Simple, high-performance file upload middleware for the **[bklar](https://www.npmjs.com/package/bklar)** framework.

This package simplifies handling `multipart/form-data` requests. It validates files, saves them to disk using Bun's optimized I/O, and organizes them neatly in your application context.

---

## ✨ Features

- ⚡ **Native Performance:** Uses `Bun.write` for the fastest possible file I/O.
- 🛡️ **Built-in Validation:** Easily restrict uploads by file size and MIME type.
- 💾 **Automatic Storage:** Automatically saves files to a destination folder, or keeps them in memory for custom processing.
- 🎲 **Smart Renaming:** Auto-generates UUIDs for filenames to prevent collisions, or lets you define custom naming logic.
- 🧩 **Type Safe:** Fully typed `ctx.state.files` for great developer experience.

## 📦 Installation

This package is designed to work with `bklar`.

```bash
bun add bklar @bklarjs/upload
```

## 🚀 Usage

### 1. Basic: Save to Disk

This example saves all uploaded files to the `./uploads` directory.

```typescript
import { Bklar } from "bklar";
import { upload } from "@bklarjs/upload";

const app = Bklar();

// Create the upload middleware
const uploadMiddleware = upload({
  dest: "./uploads",
  maxSize: 5 * 1024 * 1024, // 5MB limit
  types: ["image/png", "image/jpeg"], // Only allow images
});

app.post(
  "/upload",
  (ctx) => {
    // Regular form fields are in ctx.body
    const { username } = ctx.body;

    // Files are in ctx.state.files
    const avatar = ctx.state.files?.avatar;

    if (!avatar) {
      return ctx.json({ error: "Avatar is required" }, 400);
    }

    // If 'dest' is set, avatar is an UploadedFile object
    return ctx.json({
      message: "File uploaded!",
      file: avatar,
      // avatar.path -> "uploads/f47ac10b-58cc-4372-a567-0e02b2c3d479.png"
    });
  },
  {
    middlewares: [uploadMiddleware],
  }
);

app.listen(3000);
```

### 2. Advanced: In-Memory / Custom Handling

If you don't provide a `dest`, files are passed as native `Bun.File` objects. This is useful if you want to upload them directly to S3 or process them before saving.

```typescript
const memoryUpload = upload({
  types: /^image\//, // Allow all images
});

app.post(
  "/s3-upload",
  async (ctx) => {
    const file = ctx.state.files?.doc;

    if (file && file instanceof File) {
      // It's a native File object. You can read it as an ArrayBuffer, etc.
      const buffer = await file.arrayBuffer();

      // ... logic to upload buffer to S3 ...

      return ctx.json({ size: file.size });
    }
  },
  { middlewares: [memoryUpload] }
);
```

## ⚙️ Configuration Options

| Option      | Type                     | Default     | Description                                                                  |
| :---------- | :----------------------- | :---------- | :--------------------------------------------------------------------------- |
| `dest`      | `string`                 | `undefined` | Folder to save files. If omitted, files are not saved to disk automatically. |
| `maxSize`   | `number`                 | `Infinity`  | Max file size in bytes. Returns 413 if exceeded.                             |
| `types`     | `string[]` \| `RegExp`   | `undefined` | Allowed MIME types. Returns 415 if invalid.                                  |
| `randomize` | `boolean`                | `true`      | If true, renames files to a UUID (preserves extension).                      |
| `filename`  | `(file: File) => string` | `undefined` | Custom function to generate filenames.                                       |

## 🧩 TypeScript

The package uses module augmentation to add `files` to `ctx.state`.

```typescript
import type { UploadedFile } from "@bklarjs/upload";

// If dest is SET:
const file = ctx.state.files["fieldname"] as UploadedFile;
console.log(file.path);

// If dest is NOT SET:
const file = ctx.state.files["fieldname"] as File;
console.log(file.name);
```

## 🤝 Contributing

Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request to the main `bklar` repository.

## 📄 License

This project is licensed under the **MIT License**.
