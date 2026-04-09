import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/require-admin';
import { validate } from '../middleware/validate';
import {
  InitiateRefundSchema,
  RefundHistorySchema,
} from '../validators/refund.validator';
import {
  adminRefundRazorpay,
  adminRefundStripe,
  adminRefundPaypal,
  adminListRefunds,
  adminGetRefund,
  myRefunds,
} from '../controllers/refund.controller';

//  Admin Refund Routes
// Mounted at /api/v1/admin/refunds

export const adminRefundRouter = Router();

adminRefundRouter.use(authenticate, requireAdmin);

/** POST /api/v1/admin/refunds/razorpay/:paymentId */
adminRefundRouter.post(
  '/razorpay/:paymentId',
  validate(InitiateRefundSchema),
  adminRefundRazorpay,
);

/** POST /api/v1/admin/refunds/stripe/:paymentId */
adminRefundRouter.post(
  '/stripe/:paymentId',
  validate(InitiateRefundSchema),
  adminRefundStripe,
);

/** POST /api/v1/admin/refunds/paypal/:paymentId */
adminRefundRouter.post(
  '/paypal/:paymentId',
  validate(InitiateRefundSchema),
  adminRefundPaypal,
);

/** GET /api/v1/admin/refunds */
adminRefundRouter.get('/', validate(RefundHistorySchema), adminListRefunds);

/** GET /api/v1/admin/refunds/:refundId */
adminRefundRouter.get('/:refundId', adminGetRefund);

//  User Refund Routes
// Mounted at /api/v1/payments/refunds

export const userRefundRouter = Router();

userRefundRouter.use(authenticate);

/** GET /api/v1/payments/refunds/me */
userRefundRouter.get('/me', validate(RefundHistorySchema), myRefunds);
