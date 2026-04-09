export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors?: unknown[],
    public readonly isOperational: boolean = true,
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, errors?: unknown[]): ApiError {
    return new ApiError(400, message, errors);
  }

  static unauthorized(
    message = '🔒 Unauthorized. Please provide a valid token.',
  ): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(
    message = '🚫 Forbidden. You do not have access to this resource.',
  ): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = '🔍 Resource not found.'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message);
  }

  static unprocessable(message: string, errors?: unknown[]): ApiError {
    return new ApiError(422, message, errors);
  }

  static tooManyRequests(
    message = '⏳ Too many requests. Please slow down.',
  ): ApiError {
    return new ApiError(429, message);
  }

  static internal(message = '💥 An unexpected error occurred.'): ApiError {
    return new ApiError(500, message);
  }

  static paymentRequired(message = '💳 Payment required.'): ApiError {
    return new ApiError(402, message);
  }
}
