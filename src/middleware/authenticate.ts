import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error';
import {
  verifyServiceToken,
  extractUserIdFromPayload,
  extractRoleFromPayload,
  getDevBypassUserId,
  getDevBypassRole,
} from '../utils/jwt.util';
import { env } from '../config/env';
import { AuthUser } from '../types/express';
import jwt from 'jsonwebtoken';

// 🔒 Authentication Middleware — payments-subs-api
//
// Expects:  Authorization: Bearer <access_token>
//
// Token issuer: personal-auth-api
// Payload:      { userId, sessionToken, jti, role }
//
// On success attaches to req:
//   req.user.id           ← payload.userId   (canonical field mapping)
//   req.user.role         ← payload.role     (enables requireAdmin without DB)
//   req.user.sessionToken ← payload.sessionToken
//   req.user.jti          ← payload.jti
//
// 🛠️  Dev bypass (development only):
//   Set DEV_BYPASS_ENABLED=true in .env then send:
//     X-Dev-User-Id: <uuid>   → skips JWT entirely
//     X-Dev-Role: admin       → optional, defaults to 'user'

/**
 * Strict JWT authentication middleware.
 * Shares the same JWT_SECRET as personal-auth-api.
 *
 * Rejects requests that do not carry a valid, non-expired Bearer token.
 * Use on all routes that require a logged-in user.
 */
interface JwtPayload extends AuthUser {
  iat?: number;
  exp?: number;
}
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  const isDev = env.NODE_ENV === 'development';
  const token =
    (authHeader && authHeader.split(' ')[1]) ?? req.cookies.access_token;

  if (!token) {
    if (isDev) {
      const userId = req.headers['x-user-id'];
      const sessionId = req.headers['x-session-id'];

      if (userId || sessionId) {
        req.user = {
          userId: userId as string,
          sessionToken: sessionId as string,
        };
        return next();
      }
    }
    next(
      ApiError.unauthorized('🔒 No token provided. Please authenticate first.'),
    );
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (!decoded.userId) {
      next(ApiError.unauthorized('🔒 Invalid token payload.'));
      return;
    }

    req.user = decoded;

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized('🔒 Token has expired. Please log in again.'));
    } else if (err instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized('🔒 Invalid token. Please log in again.'));
    } else {
      next(err);
    }
  }
}

/**
 * Optional authentication middleware.
 *
 * Attaches `req.user` if a valid Bearer token is present; otherwise
 * continues without error.  Use on public routes that behave differently
 * for authenticated users.
 */
export function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  // Dev bypass also applies to optional auth
  const devUserId = getDevBypassUserId(req);
  if (devUserId) {
    req.user = { userId: devUserId, role: getDevBypassRole(req) ?? 'user' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(); // No token — continue as unauthenticated
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyServiceToken(token);

  if (payload) {
    const userId = extractUserIdFromPayload(payload);
    if (userId) {
      req.user = {
        userId,
        role: extractRoleFromPayload(payload) ?? 'user',
        sessionToken: payload.sessionToken,
        jti: payload.jti,
      };
    }
  }
  // Invalid token on optional route — ignore silently
  next();
}
