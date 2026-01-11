import { beforeEach, describe, expect, it } from "bun:test";
import { z } from "zod";
import { Bklar, type BklarApp as App } from "../app";
import { generateOpenAPI } from "../openapi";

let app: App;

beforeEach(() => {
  app = Bklar();
});

describe("OpenAPI Generator", () => {
  it("should generate basic spec with paths and params", () => {
    app.get(
      "/users/:id",
      () => ({}),
      {
        schemas: {
          params: z.object({ id: z.string() }),
          query: z.object({ page: z.number().optional() })
        }
      }
    );

    app.post(
      "/items",
      () => ({}),
      {
        schemas: {
          body: z.object({ name: z.string(), qty: z.number() })
        }
      }
    );

    const spec = generateOpenAPI(app, { title: "Test API", version: "1.0.0" });

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Test API");
    
    // Check GET /users/{id}
    expect(spec.paths["/users/{id}"]).toBeDefined();
    expect(spec.paths["/users/{id}"].get).toBeDefined();
    
    const getParams = spec.paths["/users/{id}"].get.parameters;
    expect(getParams).toHaveLength(2);
    
    const idParam = getParams.find((p: any) => p.name === "id");
    expect(idParam.in).toBe("path");
    expect(idParam.required).toBe(true);
    
    const pageParam = getParams.find((p: any) => p.name === "page");
    expect(pageParam.in).toBe("query");
    expect(pageParam.required).toBe(false);

    // Check POST /items
    expect(spec.paths["/items"]).toBeDefined();
    expect(spec.paths["/items"].post).toBeDefined();
    expect(spec.paths["/items"].post.requestBody).toBeDefined();
    
    const bodySchema = spec.paths["/items"].post.requestBody.content["application/json"].schema;
    expect(bodySchema.type).toBe("object");
    expect(bodySchema.required).toContain("name");
    expect(bodySchema.required).toContain("qty");
    expect(bodySchema.properties.name.type).toBe("string");
  });
});
