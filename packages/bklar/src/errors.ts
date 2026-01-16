import { ZodError } from "zod";

export enum ErrorType {
  VALIDATION = "VALIDATION",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED",
  CONFLICT = "CONFLICT",
  BAD_REQUEST = "BAD_REQUEST",
  INTERNAL_SERVER = "INTERNAL_SERVER",
  GONE = "GONE",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
  UNPROCESSABLE_ENTITY = "UNPROCESSABLE_ENTITY",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
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
  [ErrorType.METHOD_NOT_ALLOWED]: {
    statusCode: 405,
    defaultMessage: "Method not allowed",
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
  [ErrorType.UNPROCESSABLE_ENTITY]: {
    statusCode: 422,
    defaultMessage: "Unprocessable Entity",
  },
  [ErrorType.SERVICE_UNAVAILABLE]: {
    statusCode: 503,
    defaultMessage: "Service Unavailable",
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
    const body: Record<string, any> = { message: this.message };

    if (this.details) {
      body.errors = this.details;
    }

    return new Response(JSON.stringify(body), {
      status: this.statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export function defaultErrorHandler(error: unknown): Response {
  if (error instanceof HttpError) {
    return error.toResponse();
  }

  if (error instanceof ZodError) {
    return new HttpError(
      ErrorType.VALIDATION,
      "Validation failed",
      error.flatten().fieldErrors,
    ).toResponse();
  }

  return new HttpError(ErrorType.INTERNAL_SERVER).toResponse();
}

export class NotFoundError extends HttpError {
  constructor(message?: string, details?: any) {
    super(ErrorType.NOT_FOUND, message, details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message?: string, details?: any) {
    super(ErrorType.FORBIDDEN, message, details);
  }
}

export class ConflictError extends HttpError {
  constructor(message?: string, details?: any) {
    super(ErrorType.CONFLICT, message, details);
  }
}

export class BadRequestError extends HttpError {
  constructor(message?: string, details?: any) {
    super(ErrorType.BAD_REQUEST, message, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message?: string, details?: any) {
    super(ErrorType.UNAUTHORIZED, message, details);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message?: string, details?: any) {
    super(ErrorType.TOO_MANY_REQUESTS, message, details);
  }
}

export class GoneError extends HttpError {
  constructor(message?: string, details?: any) {
    super(ErrorType.GONE, message, details);
  }
}

export class InternalServerError extends HttpError {
  constructor(message?: string, details?: any) {
    super(ErrorType.INTERNAL_SERVER, message, details);
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(message?: string, details?: any) {
    super(ErrorType.METHOD_NOT_ALLOWED, message, details);
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message?: string, details?: any) {
    super(ErrorType.UNPROCESSABLE_ENTITY, message, details);
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message?: string, details?: any) {
    super(ErrorType.SERVICE_UNAVAILABLE, message, details);
  }
}
