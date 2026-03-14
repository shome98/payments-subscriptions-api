import { Request, Response, NextFunction } from 'express';
import * as service from '../services/stripe.service';
import { sendSuccess } from '../utils/api-response';
import { ApiError } from '../utils/api-error';
import type {
  CreateStripeSessionDto,
  PaymentHistoryDto,
} from '../validators/payment.validator';

/** POST /api/v1/payments/stripe/create-session */
export async function createSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    if (!userId || !userEmail) return void next(ApiError.unauthorized());
    const result = await service.createCheckoutSession(
      userId,
      userEmail,
      req.body as CreateStripeSessionDto,
    );
    sendSuccess(
      res,
      '🛒 Stripe checkout session created. Redirect user to sessionUrl.',
      result,
      201,
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/payments/stripe/success?session_id=xxx */
export async function sessionSuccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionId = req.query.session_id as string;
    if (!sessionId)
      return void next(ApiError.badRequest('❌ session_id is required.'));
    const payment = await service.handleSessionSuccess(sessionId);
    sendSuccess(
      res,
      '🎉 Stripe payment succeeded! Subscription activated.',
      payment,
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/payments/stripe/cancel */
export async function sessionCancel(
  _req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  sendSuccess(res, '❌ Stripe payment cancelled. No charges were made.');
}

/** GET /api/v1/payments/stripe/history */
export async function getHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());
    const { payments, meta } = await service.getPaymentHistory(
      userId,
      req.query as unknown as PaymentHistoryDto,
    );
    sendSuccess(
      res,
      `✅ Retrieved ${payments.length} Stripe payment(s).`,
      payments,
      200,
      meta,
    );
  } catch (err) {
    next(err);
  }
}
