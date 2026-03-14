import { Request, Response, NextFunction } from 'express';
import * as subscriptionService from '../services/subscription.service';
import { sendSuccess } from '../utils/api-response';
import { ApiError } from '../utils/api-error';

/**
 * GET /api/v1/internal/subscriptions/check/:userId
 * Returns whether the user can create a new API, along with their current tier.
 * Consumed by: CRUD Factory
 */
export async function checkSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { userId } = req.params;
    if (!userId)
      return void next(ApiError.badRequest('❌ userId is required.'));

    const result = await subscriptionService.checkSubscriptionLimit(
      userId as string,
    );
    sendSuccess(
      res,
      result.canCreate
        ? `✅ User can create APIs. ${result.limitLeft} slot(s) remaining.`
        : `🚫 ${result.reason}`,
      result,
    );
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/internal/subscriptions/decrement/:userId
 * Decrements the user's remaining API creation count by 1.
 * Body: { apiId?: string }
 * Consumed by: CRUD Factory after successful API creation.
 */
export async function decrementSubscriptionLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { userId } = req.params;
    if (!userId)
      return void next(ApiError.badRequest('❌ userId is required.'));

    const apiId = (req.body as { apiId?: string }).apiId;
    await subscriptionService.decrementLimit(userId as string, apiId);

    sendSuccess(res, '✅ Subscription limit decremented successfully.');
  } catch (err) {
    next(err);
  }
}
