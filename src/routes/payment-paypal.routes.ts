import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { paymentCreateLimiter } from '../middleware/rate-limiter';
import {
  createPaypalOrderSchema,
  capturePaypalOrderParamSchema,
  paymentHistorySchema,
} from '../validators/payment.validator';
import * as controller from '../controllers/paypal.controller';

const router = Router();

router.use(authenticate);

/** POST /api/v1/payments/paypal/create-order */
router.post(
  '/create-order',
  paymentCreateLimiter,
  validate(createPaypalOrderSchema),
  controller.createOrder,
);

/** POST /api/v1/payments/paypal/capture/:orderId */
router.post(
  '/capture/:orderId',
  validate(capturePaypalOrderParamSchema, 'params'),
  controller.captureOrder,
);

/** GET /api/v1/payments/paypal/history */
router.get(
  '/history',
  validate(paymentHistorySchema, 'query'),
  controller.getHistory,
);

export default router;
