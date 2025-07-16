import type { BklarInstance } from "bklar";
import { getAbsoluteFSPath } from "swagger-ui-dist";
import { generateOpenAPI } from "./openapi-generator";
import { getScalarHTML, getSwaggerHTML } from "./ui";

export interface SwaggerOptions {
  path?: string;
  openapi?: {
    title?: string;
    version?: string;
    description?: string;
  };
}

export function swagger(options: SwaggerOptions = {}) {
  const config = {
    path: options.path || "/docs",
    openapi: options.openapi || {},
  };

  // Internal function to generate the OpenAPI spec
  const _generateSpec = (app: BklarInstance) => {
    return generateOpenAPI(app, config.openapi);
  };

  // The setup function to be called on the app instance
  const setup = (app: BklarInstance) => {
    // Generate the OpenAPI spec only once
    const openApiSpec = _generateSpec(app);

    const jsonPath = `${config.path}/json`;
    const swaggerPath = `${config.path}/swagger`;
    const scalarPath = `${config.path}/scalar`;

    console.log(`[bklar-swagger] 📄 OpenAPI JSON available at ${jsonPath}`);
    console.log(`[bklar-swagger] Swagger UI available at ${swaggerPath}`);
    console.log(`[bklar-swagger] Scalar UI available at ${scalarPath}`);

    // 1. Add the /json route
    app.get(jsonPath, (ctx) => ctx.json(openApiSpec));

    // 2. Add the /swagger route
    app.get(
      swaggerPath,
      () =>
        new Response(getSwaggerHTML(jsonPath), {
          headers: { "Content-Type": "text/html" },
        })
    );

    // Serve Swagger's static assets
    const swaggerAssetsPath = getAbsoluteFSPath();
    app.get(
      `${config.path}/swagger-ui.css`,
      () => new Response(Bun.file(`${swaggerAssetsPath}/swagger-ui.css`))
    );
    app.get(
      `${config.path}/swagger-ui-bundle.js`,
      () => new Response(Bun.file(`${swaggerAssetsPath}/swagger-ui-bundle.js`))
    );

    // 3. Add the /scalar route
    app.get(
      scalarPath,
      () =>
        new Response(getScalarHTML(jsonPath), {
          headers: { "Content-Type": "text/html" },
        })
    );
  };

  return { setup, _generateSpec };
}
