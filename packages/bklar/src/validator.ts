import { z } from "zod";

export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  error?: any;
}

export interface ValidatorAdapter {
  validate(
    schema: any,
    data: unknown
  ): Promise<ValidationResult> | ValidationResult;
  
  getJsonSchema(schema: any): any;
}

export class ZodValidator implements ValidatorAdapter {
  validate(schema: z.ZodType<any>, data: unknown): ValidationResult {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return {
      success: false,
      error: result.error.flatten().fieldErrors,
    };
  }

  getJsonSchema(schema: z.ZodType<any>): any {
      // Basic recursive schema converter
      if (schema instanceof z.ZodObject) {
          const properties: Record<string, any> = {};
          const required: string[] = [];
          
          for (const key in schema.shape) {
              const field = schema.shape[key];
              properties[key] = this.getJsonSchema(field);
              if (!field.isOptional()) {
                  required.push(key);
              }
          }
          return { type: "object", properties, required };
      }
      
      if (schema instanceof z.ZodString) return { type: "string" };
      if (schema instanceof z.ZodNumber) return { type: "number" };
      if (schema instanceof z.ZodBoolean) return { type: "boolean" };
      if (schema instanceof z.ZodArray) {
          return { type: "array", items: this.getJsonSchema(schema.element) };
      }
      // Fallback
      return { type: "string" };
  }
}

export const defaultValidator = new ZodValidator();
