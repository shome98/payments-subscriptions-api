import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/require-admin';
import { adminLimiter } from '../middleware/rate-limiter';
import { validate } from '../middleware/validate';
import {
  createTierSchema,
  updateTierSchema,
  paginationSchema,
  uuidParamSchema as tierUuidParam,
} from '../validators/tier.validator';
import {
  createDiscountSchema,
  updateDiscountSchema,
  uuidParamSchema as discountUuidParam,
} from '../validators/discount.validator';
import {
  subscriptionPaginationSchema,
  updateSubscriptionSchema,
  uuidParamSchema as subUuidParam,
} from '../validators/subscription.validator';

import * as tierController from '../controllers/tier.controller';
import * as discountController from '../controllers/discount.controller';
import * as subscriptionController from '../controllers/subscription.controller';
import * as adminController from '../controllers/admin.controller';

const router = Router();

//  All admin routes require JWT + admin role
router.use(authenticate, requireAdmin, adminLimiter);

//  Tiers

router.get(
  '/tiers',
  validate(paginationSchema, 'query'),
  tierController.adminGetAllTiers,
);
router.post('/tiers', validate(createTierSchema), tierController.createTier);
router.patch(
  '/tiers/:id',
  validate(tierUuidParam, 'params'),
  validate(updateTierSchema),
  tierController.updateTier,
);
router.delete(
  '/tiers/:id',
  validate(tierUuidParam, 'params'),
  tierController.deleteTier,
);

//  Discounts

router.get('/discounts', discountController.getAllDiscounts);
router.get(
  '/discounts/:id',
  validate(discountUuidParam, 'params'),
  discountController.getDiscountById,
);
router.post(
  '/discounts',
  validate(createDiscountSchema),
  discountController.createDiscount,
);
router.patch(
  '/discounts/:id',
  validate(discountUuidParam, 'params'),
  validate(updateDiscountSchema),
  discountController.updateDiscount,
);
router.delete(
  '/discounts/:id',
  validate(discountUuidParam, 'params'),
  discountController.deleteDiscount,
);

//  Subscriptions

router.get(
  '/subscriptions',
  validate(subscriptionPaginationSchema, 'query'),
  subscriptionController.adminGetAllSubscriptions,
);
router.patch(
  '/subscriptions/:id',
  validate(subUuidParam, 'params'),
  validate(updateSubscriptionSchema),
  subscriptionController.adminUpdateSubscription,
);

//  Payments

router.get('/payments', adminController.adminGetPayments);

export default router;
