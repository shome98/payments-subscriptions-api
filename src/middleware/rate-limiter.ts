import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { sendError } from '../utils/api-response';

const handler = (message: string) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, message, 429),
  });

//  Global limiter: 100 req / 15 min per IP
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(
      res,
      '⏳ Too many requests. Please slow down and try again later.',
      429,
    ),
});

//  Payment creation: 20 req / hour per IP
export const paymentCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(res, '⏳ Payment request limit reached. Max 20 per hour.', 429),
});

//  Webhook endpoints: 200 req / min per IP (high volume expected)
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(res, '⏳ Webhook rate limit exceeded.', 429),
});

//  Internal service-to-service: 500 req / min
export const internalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(res, '⏳ Internal rate limit exceeded.', 429),
});

//  Admin endpoints: 60 req / 15 min
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(res, '⏳ Admin request limit exceeded. Please slow down.', 429),
});

//  Discount validation: 30 req / 15 min per IP
export const discountValidateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(res, '⏳ Too many discount validation attempts.', 429),
});

// suppress unused warning — handler factory is kept for future use
void handler;
