import { Router } from 'express';
import { validate } from '../middleware/validate';
import {
  createTierSchema,
  updateTierSchema,
  paginationSchema,
  uuidParamSchema,
  tiersByIdsSchema,
} from '../validators/tier.validator';
import * as controller from '../controllers/tier.controller';

const router = Router();

//  Public routes (no auth)

/** GET /api/v1/tiers — active tiers for client display */
router.get('/', validate(paginationSchema, 'query'), controller.getActiveTiers);

/** GET /api/v1/tiers/:id — single tier */
router.get('/:id', validate(uuidParamSchema, 'params'), controller.getTierById);

/** POST /api/v1/tiers/by-ids — batch fetch by IDs for client display */
router.post('/by-ids', validate(tiersByIdsSchema), controller.getTiersByIds);

export default router;
