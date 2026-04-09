import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error';

/**
 * Require authenticated user to have role="admin".
 * Must be used AFTER authenticate middleware.
 */
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next(ApiError.unauthorized());
    return;
  }
  if (req.user.role !== 'admin') {
    next(ApiError.forbidden('🚫 Admin access required.'));
    return;
  }
  next();
}
