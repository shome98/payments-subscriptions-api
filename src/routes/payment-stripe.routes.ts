import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { paymentCreateLimiter } from '../middleware/rate-limiter';
import {
  createStripeSessionSchema,
  paymentHistorySchema,
} from '../validators/payment.validator';
import * as controller from '../controllers/stripe.controller';

const router = Router();

router.use(authenticate);

/** POST /api/v1/payments/stripe/create-session */
router.post(
  '/create-session',
  paymentCreateLimiter,
  validate(createStripeSessionSchema),
  controller.createSession,
);

/** GET /api/v1/payments/stripe/success?session_id=xxx */
router.get('/success', controller.sessionSuccess);

/** GET /api/v1/payments/stripe/cancel */
router.get('/cancel', controller.sessionCancel);

/** GET /api/v1/payments/stripe/history */
router.get(
  '/history',
  validate(paymentHistorySchema, 'query'),
  controller.getHistory,
);

export default router;
