// 🔒 Express Request Augmentation — payments-subs-api
//
// req.user is populated by the authenticate() middleware after
// verifying the JWT issued by personal-auth-api.
//
// Payload mapping:
//   payload.userId       → req.user.id
//   payload.role         → req.user.role     ← enables requireAdmin()
//   payload.sessionToken → req.user.sessionToken
//   payload.jti          → req.user.jti
//

/**
 * Authenticated user object attached to every request that passes
 * through the authenticate() middleware.
 *
 * `id` is always present after auth.  All other fields are optional
 * because they may not be set by the dev-bypass path.
 */
export interface AuthUser {
  /** PG users.id UUID — mapped from JWT payload.userId */
  userId: string;
  email?: string;
  /**
   * User role from the JWT payload ('user' | 'admin').
   * Embedded in the token so requireAdmin() works without a DB call.
   */
  role?: string;
  /**
   * Raw PG session token carried from the JWT payload.
   * Useful for cross-service session correlation.
   */
  sessionToken?: string;
  /**
   * JWT ID (UUID) carried from the payload.
   * Available for downstream blocklist-aware logic if needed.
   */
  jti?: string;
}

declare global {
  namespace Express {
    interface Request {
      /** Set by authenticate() / optionalAuthenticate() middleware. */
      user?: AuthUser;
    }
  }
}

export {};
