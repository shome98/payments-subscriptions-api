import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import * as controller from '../controllers/subscription.controller';

const router = Router();

//  Authenticated routes

/** GET /api/v1/subscriptions/me — current user subscription */
router.get('/me', authenticate, controller.getMySubscription);

export default router;
