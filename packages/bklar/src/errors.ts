import { ZodError } from "zod";

export enum ErrorType {
  VALIDATION = "VALIDATION",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  BAD_REQUEST = "BAD_REQUEST",
  INTERNAL_SERVER = "INTERNAL_SERVER",
  GONE = "GONE",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
}

const ERROR_METADATA: Record<
  ErrorType,
  { statusCode: number; defaultMessage: string }
> = {
  [ErrorType.VALIDATION]: {
    statusCode: 400,
    defaultMessage: "Validation failed",
  },
  [ErrorType.UNAUTHORIZED]: { statusCode: 401, defaultMessage: "Unauthorized" },
  [ErrorType.FORBIDDEN]: { statusCode: 403, defaultMessage: "Forbidden" },
  [ErrorType.NOT_FOUND]: {
    statusCode: 404,
    defaultMessage: "Resource not found",
  },
  [ErrorType.CONFLICT]: {
    statusCode: 409,
    defaultMessage: "A conflict occurred",
  },
  [ErrorType.GONE]: {
    statusCode: 410,
    defaultMessage: "This resource is no longer available",
  },
  [ErrorType.TOO_MANY_REQUESTS]: {
    statusCode: 429,
    defaultMessage: "Too many requests",
  },
  [ErrorType.BAD_REQUEST]: { statusCode: 400, defaultMessage: "Bad request" },
  [ErrorType.INTERNAL_SERVER]: {
    statusCode: 500,
    defaultMessage: "Internal server error",
  },
};

export class HttpError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(type: ErrorType, message?: string, details?: any) {
    const metadata = ERROR_METADATA[type];
    super(message ?? metadata.defaultMessage);
    this.name = "HttpError";
    this.type = type;
    this.statusCode = metadata.statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toResponse(): Response {
    const body: { message: string; errors?: any } = { message: this.message };
    if (this.details) {
      body.errors = this.details;
    }
    return new Response(JSON.stringify(body), {
      status: this.statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export class ErrorHandler {
  static handle(error: unknown): Response {
    if (error instanceof HttpError) {
      return error.toResponse();
    }

    if (error instanceof ZodError) {
      return new HttpError(
        ErrorType.VALIDATION,
        "Validation failed",
        error.flatten().fieldErrors
      ).toResponse();
    }

    // Log any unhandled error for observability
    console.error("Unhandled Application Error:", error);

    return new HttpError(ErrorType.INTERNAL_SERVER).toResponse();
  }
}

export class NotFoundError extends HttpError {
  constructor(message?: string) {
    super(ErrorType.NOT_FOUND, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message?: string) {
    super(ErrorType.FORBIDDEN, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message?: string) {
    super(ErrorType.CONFLICT, message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message?: string) {
    super(ErrorType.BAD_REQUEST, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message?: string) {
    super(ErrorType.UNAUTHORIZED, message);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message?: string) {
    super(ErrorType.TOO_MANY_REQUESTS, message);
  }
}
