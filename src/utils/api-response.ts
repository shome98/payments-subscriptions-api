import { Response } from 'express';

//  Response Shapes

export interface SuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors?: unknown[];
  timestamp: string;
}

//  Helpers

export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200,
  meta?: Record<string, unknown>,
): Response {
  const payload: SuccessResponse<T> = {
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(meta && { meta }),
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: unknown[],
): Response {
  const payload: ErrorResponse = {
    success: false,
    message,
    ...(errors && errors.length > 0 && { errors }),
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(payload);
}
