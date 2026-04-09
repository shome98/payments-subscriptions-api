import { Router } from 'express';
import { requireInternal } from '../middleware/require-internal';
import { internalLimiter } from '../middleware/rate-limiter';
import { validate } from '../middleware/validate';
import { userIdParamSchema } from '../validators/subscription.validator';
import * as controller from '../controllers/internal.controller';

const router = Router();

//  All internal routes require X-Internal-API-Key header
router.use(internalLimiter, requireInternal);

/**
 * GET /api/v1/internal/subscriptions/check/:userId
 * Check if user can create a new API + their tier info.
 */
router.get(
  '/subscriptions/check/:userId',
  validate(userIdParamSchema, 'params'),
  controller.checkSubscription,
);

/**
 * POST /api/v1/internal/subscriptions/decrement/:userId
 * Decrement API creation count after successful API creation.
 * Body: { apiId?: string }
 */
router.post(
  '/subscriptions/decrement/:userId',
  validate(userIdParamSchema, 'params'),
  controller.decrementSubscriptionLimit,
);

export default router;
