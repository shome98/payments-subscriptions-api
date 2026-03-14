import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { paymentCreateLimiter } from '../middleware/rate-limiter';
import {
  createRazorpayOrderSchema,
  verifyRazorpayPaymentSchema,
  paymentHistorySchema,
} from '../validators/payment.validator';
import * as controller from '../controllers/razorpay.controller';

const router = Router();

router.use(authenticate);

/** POST /api/v1/payments/razorpay/create-order */
router.post(
  '/create-order',
  paymentCreateLimiter,
  validate(createRazorpayOrderSchema),
  controller.createOrder,
);

/** POST /api/v1/payments/razorpay/verify */
router.post(
  '/verify',
  validate(verifyRazorpayPaymentSchema),
  controller.verifyPayment,
);

/** GET /api/v1/payments/razorpay/history */
router.get(
  '/history',
  validate(paymentHistorySchema, 'query'),
  controller.getHistory,
);

export default router;
