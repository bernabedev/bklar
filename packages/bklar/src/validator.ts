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
}

export const defaultValidator = new ZodValidator();
