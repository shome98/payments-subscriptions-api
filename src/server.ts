import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';
import { API_PREFIX } from './config/constants';
import { env, getClientUrls } from './config/env';
import { globalRateLimiter } from './middleware/rate-limiter';
import { errorHandler } from './middleware/error-handler';
import { sendSuccess, sendError } from './utils/api-response';
//  Routes
import tierRoutes from './routes/tier.routes';
import discountRoutes from './routes/discount.routes';
import subscriptionRoutes from './routes/subscription.routes';
import razorpayRoutes from './routes/payment-razorpay.routes';
import stripeRoutes from './routes/payment-stripe.routes';
import paypalRoutes from './routes/payment-paypal.routes';
import webhookRoutes from './routes/webhook.routes';
import internalRoutes from './routes/internal.routes';
import adminRoutes from './routes/admin.routes';
import { adminRefundRouter, userRefundRouter } from './routes/refund.routes';
import logger from './utils/logger';
import cookieParser from 'cookie-parser';

// 💳 Payments & Subscriptions API — Express App

const app = express();

//  Trust first proxy (Nginx, ALB, etc.)
app.set('trust proxy', 1);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        userId: (req as any).auth?.userId,
        apiId: (req as any).params?.apiId,
      },
    );
  });
  next();
});
//  Security headers
app.use(helmet());

//  CORS — comma-separated CLIENT_URL env var
const allowedOrigins = getClientUrls();
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow no-origin (server-to-server, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error(`🚫 CORS: Origin "${origin}" not allowed.`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Internal-API-Key',
      'X-Request-Id',
    ],
  }),
);

//  Stripe webhook — MUST use raw body BEFORE express.json()
app.use(
  `${API_PREFIX}/webhooks/stripe`,
  express.raw({ type: 'application/json' }),
);

//  Razorpay webhook — capture raw body for HMAC verification
app.use(
  `${API_PREFIX}/webhooks/razorpay`,
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: string }).rawBody =
        buf.toString('utf8');
    },
  }),
);

//  Body parsing (all other routes)
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));
app.use(cookieParser());

//  Correlation ID
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9\-_]{1,128}$/;
app.use((req, res, next) => {
  const clientId = req.headers['x-request-id'] as string | undefined;
  const requestId =
    clientId && REQUEST_ID_PATTERN.test(clientId)
      ? clientId
      : crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  next();
});

//  Global rate limiter
app.use(globalRateLimiter);

app.get('/', (req: Request, res: Response) => {
  sendSuccess(res, '😊 Welcome start paying!', {
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});
//  Health check
app.get('/healthz', (_req, res) => {
  sendSuccess(res, '💚 Payments & Subscriptions API is healthy!', {
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});
//  Health check
app.get('/readyz', (_req, res) => {
  sendSuccess(res, '🚀 Payments & Subscriptions API is ready!', {
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

//  API Routes

// Public routes
app.use(`${API_PREFIX}/tiers`, tierRoutes);
app.use(`${API_PREFIX}/discounts`, discountRoutes);

// Authenticated user routes
app.use(`${API_PREFIX}/subscriptions`, subscriptionRoutes);
app.use(`${API_PREFIX}/payments/razorpay`, razorpayRoutes);
app.use(`${API_PREFIX}/payments/stripe`, stripeRoutes);
app.use(`${API_PREFIX}/payments/paypal`, paypalRoutes);
app.use(`${API_PREFIX}/payments/refunds`, userRefundRouter);

// Webhook routes (signature-verified, no JWT)
app.use(`${API_PREFIX}/webhooks`, webhookRoutes);

// Internal service-to-service routes (X-Internal-API-Key)
app.use(`${API_PREFIX}/internal`, internalRoutes);

// Admin routes (JWT + role=admin)
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/admin/refunds`, adminRefundRouter);

//  404 handler
app.use((req, res) => {
  sendError(res, `🔍 Route ${req.method} ${req.originalUrl} not found.`, 404);
});

//  Global error handler (must be last)
app.use(errorHandler);

export default app;
