import type { BklarApp } from "./app";

export interface InfoObject {
  title: string;
  version: string;
  description?: string;
}

export function generateOpenAPI(app: BklarApp<any>, info: InfoObject) {
  const paths: Record<string, any> = {};

  const routes = app.router.getRoutes();

  for (const route of routes) {
    // Convert path from /users/:id to /users/{id} for OpenAPI
    const openApiPath = route.path.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");

    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }

    const method = route.method.toLowerCase();
    const operation: any = {
      responses: {
        "200": {
          description: "Successful response",
        },
      },
    };

    if (route.options.schemas) {
      const schemas = route.options.schemas;
      
      // Parameters (Path and Query)
      const parameters: any[] = [];
      
      if (schemas.params) {
          const jsonSchema = app.validator.getJsonSchema(schemas.params);
          if (jsonSchema.properties) {
              for (const key in jsonSchema.properties) {
                  parameters.push({
                      name: key,
                      in: "path",
                      required: true,
                      schema: jsonSchema.properties[key]
                  });
              }
          }
      }

      if (schemas.query) {
        const jsonSchema = app.validator.getJsonSchema(schemas.query);
        if (jsonSchema.properties) {
            for (const key in jsonSchema.properties) {
                parameters.push({
                    name: key,
                    in: "query",
                    required: jsonSchema.required?.includes(key) || false,
                    schema: jsonSchema.properties[key]
                });
            }
        }
      }

      if (parameters.length > 0) {
          operation.parameters = parameters;
      }

      // Request Body
      if (schemas.body) {
          const jsonSchema = app.validator.getJsonSchema(schemas.body);
          operation.requestBody = {
              content: {
                  "application/json": {
                      schema: jsonSchema
                  }
              }
          };
      }
    }

    paths[openApiPath][method] = operation;
  }

  return {
    openapi: "3.1.0",
    info,
    paths,
  };
}
