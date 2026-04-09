import { Request, Response, NextFunction } from 'express';
import * as service from '../services/subscription.service';
import { sendSuccess } from '../utils/api-response';
import { ApiError } from '../utils/api-error';
import type {
  UpdateSubscriptionDto,
  SubscriptionPaginationDto,
} from '../validators/subscription.validator';

//  Authenticated user

/** GET /api/v1/subscriptions/me */
export async function getMySubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());
    const sub = await service.getOrCreateSubscription(userId);
    sendSuccess(res, '✅ Your subscription details.', sub);
  } catch (err) {
    next(err);
  }
}

//  Admin

/** GET /api/v1/admin/subscriptions */
export async function adminGetAllSubscriptions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { subscriptions, meta } = await service.getAllSubscriptions(
      req.query as unknown as SubscriptionPaginationDto,
    );
    sendSuccess(
      res,
      `✅ Retrieved ${subscriptions.length} subscription(s).`,
      subscriptions,
      200,
      meta,
    );
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/admin/subscriptions/:id */
export async function adminUpdateSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sub = await service.adminUpdateSubscription(
      req.params.id as string,
      req.body as UpdateSubscriptionDto,
    );
    sendSuccess(res, '✅ Subscription updated successfully.', sub);
  } catch (err) {
    next(err);
  }
}
