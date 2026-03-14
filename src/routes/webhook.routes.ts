import { Router } from 'express';
import { webhookLimiter } from '../middleware/rate-limiter';
import * as controller from '../controllers/webhook.controller';

const router = Router();

router.use(webhookLimiter);

/**
 * POST /api/v1/webhooks/razorpay
 * Raw body is captured via express.raw() mounted in app.ts for this path.
 */
router.post('/razorpay', controller.razorpayWebhook);

/**
 * POST /api/v1/webhooks/stripe
 * Uses express.raw() middleware — Stripe requires raw Buffer for sig verification.
 */
router.post('/stripe', controller.stripeWebhook);

/**
 * POST /api/v1/webhooks/paypal
 */
router.post('/paypal', controller.paypalWebhook);

export default router;
