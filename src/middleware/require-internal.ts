import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { timingSafeCompare } from '../utils/crypto';
import { ApiError } from '../utils/api-error';

/**
 * Internal service-to-service authentication.
 * Used for endpoints consumed by CRUD factory (cross-service calls).
 *
 * Expects: X-Internal-API-Key: <INTERNAL_API_KEY>
 */
export function requireInternal(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const key = req.headers['x-internal-api-key'];

  if (!key || typeof key !== 'string') {
    next(ApiError.unauthorized('🔒 Missing internal API key.'));
    return;
  }

  if (!timingSafeCompare(key, env.INTERNAL_API_KEY)) {
    next(ApiError.forbidden('🚫 Invalid internal API key.'));
    return;
  }

  next();
}
