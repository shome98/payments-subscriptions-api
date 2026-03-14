import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3002),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT — must match the secret used in personal-auth-api
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  /**
   * 🛠️  Dev bypass flag — development & local testing only.
   *
   * When true, the authenticate() middleware accepts an
   * `X-Dev-User-Id` header instead of a real JWT.  Optionally pair with
   * `X-Dev-Role: admin` to simulate admin access.
   *
   * ⚠️  NEVER set this to true in production.
   *     The middleware also hard-checks NODE_ENV=development.
   */
  DEV_BYPASS_ENABLED: z.stringbool().default(false),

  // Internal service-to-service shared key
  INTERNAL_API_KEY: z
    .string()
    .min(16, 'INTERNAL_API_KEY must be at least 16 characters'),

  // CORS — comma-separated list of allowed origins
  CLIENT_URL: z.string().default('http://localhost:5173'),

  // ENCRYPTION_KEY: z.string().length(32, "ENCRYPTION_KEY must be exactly 32 characters").optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // ── Razorpay ──────────────────────────────────────────────────────────────
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),

  // ── Stripe ────────────────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_SUCCESS_URL: z.url().optional(),
  STRIPE_CANCEL_URL: z.url().optional(),

  // ── PayPal ────────────────────────────────────────────────────────────────
  PAYPAL_CLIENT_ID: z.string().min(1).optional(),
  PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),
  PAYPAL_WEBHOOK_ID: z.string().min(1).optional(),
  PAYPAL_BASE_URL: z.url().default('https://api-m.sandbox.paypal.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
