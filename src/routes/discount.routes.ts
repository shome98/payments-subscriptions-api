import { Router } from 'express';
import { validate } from '../middleware/validate';
import { discountValidateLimiter } from '../middleware/rate-limiter';
import { validateDiscountQuerySchema } from '../validators/discount.validator';
import * as controller from '../controllers/discount.controller';

const router = Router();

//  Public

/** GET /api/v1/discounts/validate?code=X&tierId=Y */
router.get(
  '/validate',
  discountValidateLimiter,
  validate(validateDiscountQuerySchema, 'query'),
  controller.validateDiscount,
);

export default router;
