import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { env } from '../config/env';

// 🔑 JWT Service Utility — payments-subs-api
//
// Purpose:
//   Single, canonical place for all JWT-related operations in this
//   service.  Prevents scattered `jwt.verify` calls and field-name
//   confusion (the issuer uses `payload.userId`, NOT `payload.id`).
//
// Token issuer: personal-auth-api
//   Payload shape: { userId, email, sessionToken, jti, role }
//   Secret:        JWT_SECRET  ← must be the SAME value across all services
//
// Local development bypass:
//   When NODE_ENV=development AND DEV_BYPASS_ENABLED=true, any request
//   that carries the header `X-Dev-User-Id` will skip JWT verification
//   entirely.  This lets you test authenticated endpoints with curl /
//   Postman without spinning up the full auth service.
//
//   ⚠️  The bypass is HARD-DISABLED in production — env.NODE_ENV check
//       is intentional and must never be removed.
//

/**
 * Shape of the JWT access token payload issued by personal-auth-api.
 *
 *  Field notes
 * userId       – the PG users.id UUID
 * sessionToken – raw PG session token; allows downstream services to
 *                correlate with the sessions table if needed
 * jti          – JWT ID (UUID); used for blocklist checks on logout
 * role         – 'user' | 'admin'; embedded so consumer services can
 *                authorise admin routes without an extra DB call
 */
export interface JwtServicePayload {
  userId: string;
  email?: string;
  sessionToken: string;
  jti: string;
  role: string;
  /** Standard JWT issued-at claim (seconds since epoch) */
  iat?: number;
  /** Standard JWT expiry claim (seconds since epoch) */
  exp?: number;
}

//  Verification

/**
 * Verify a Bearer token issued by personal-auth-api.
 *
 * Uses the shared JWT_SECRET.  Signature and expiry are checked locally —
 * no network call required on the happy path.
 *
 * @returns Decoded payload or `null` if the token is invalid / expired.
 */
export function verifyServiceToken(token: string): JwtServicePayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtServicePayload;
  } catch {
    // TokenExpiredError, JsonWebTokenError, NotBeforeError — all treated as null
    return null;
  }
}

/**
 * Decode a JWT **without** verifying the signature.
 *
 * Use only for non-auth purposes: logging, extracting `jti` from an
 * already-expired token on logout, diagnostics.
 *
 * ⚠️  NEVER use the result of this function to make auth decisions.
 *
 * @returns Decoded payload or `null` if the token is malformed.
 */
export function decodeServiceToken(token: string): JwtServicePayload | null {
  try {
    return jwt.decode(token) as JwtServicePayload;
  } catch {
    return null;
  }
}

//  Field extraction

/**
 * Extract `userId` from a verified payload.
 *
 * Single canonical source for the field name — prevents the common bug
 * of reading `payload.id` (undefined) instead of `payload.userId`.
 *
 * @returns The userId string, or `null` if the payload is falsy.
 */
export function extractUserIdFromPayload(
  payload: JwtServicePayload | null,
): string | null {
  return payload?.userId ?? null;
}

/**
 * Extract `role` from a verified payload.
 *
 * @returns The role string (e.g. 'user' | 'admin'), or `null`.
 */
export function extractRoleFromPayload(
  payload: JwtServicePayload | null,
): string | null {
  return payload?.role ?? null;
}

//  Dev bypass

/**
 * 🛠️  DEV BYPASS — local development & integration testing ONLY.
 *
 * When all three conditions are met:
 *   1. NODE_ENV === 'development'
 *   2. DEV_BYPASS_ENABLED === true  (set in .env)
 *   3. Request header  X-Dev-User-Id: <uuid>  is present
 *
 * …this function returns the header value as the userId, bypassing JWT
 * verification entirely.  This lets you hit authenticated endpoints
 * with curl / Postman / test runners without a real token.
 *
 * Example:
 *   curl -H "X-Dev-User-Id: 550e8400-e29b-41d4-a716-446655440000" \
 *        -H "X-Dev-Role: admin" \
 *        http://localhost:3002/api/v1/subscriptions/me
 *
 * ⚠️  This is HARD-DISABLED in production.
 *     The `env.NODE_ENV !== 'development'` guard is intentional.
 *     Do NOT remove it.
 *
 * @returns userId string from the header, or `null` if bypass is inactive.
 */
export function getDevBypassUserId(req: Request): string | null {
  // Guard 1: must be development environment
  if (env.NODE_ENV !== 'development') return null;

  // Guard 2: explicit opt-in via env flag (prevents accidental bypass)
  if (!env.DEV_BYPASS_ENABLED) return null;

  const devUserId = req.headers['x-dev-user-id'];
  if (devUserId && typeof devUserId === 'string' && devUserId.trim()) {
    return devUserId.trim();
  }

  return null;
}

/**
 * Get the dev bypass role from the request header.
 *
 * When the dev bypass is active you can simulate an admin user:
 *   X-Dev-Role: admin
 *
 * Defaults to 'user' if the header is absent.
 *
 * @returns role string or `null` if bypass is inactive.
 */
export function getDevBypassRole(req: Request): string | null {
  if (env.NODE_ENV !== 'development') return null;
  if (!env.DEV_BYPASS_ENABLED) return null;

  const devRole = req.headers['x-dev-role'];
  if (devRole && typeof devRole === 'string' && devRole.trim()) {
    return devRole.trim();
  }

  // Default dev role — safe fallback
  return 'user';
}
