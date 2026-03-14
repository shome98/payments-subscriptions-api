import { Request, Response, NextFunction } from 'express';
import * as service from '../services/paypal.service';
import { sendSuccess } from '../utils/api-response';
import { ApiError } from '../utils/api-error';
import type {
  CreatePaypalOrderDto,
  PaymentHistoryDto,
} from '../validators/payment.validator';

/** POST /api/v1/payments/paypal/create-order */
export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());
    const result = await service.createOrder(
      userId,
      req.body as CreatePaypalOrderDto,
    );
    sendSuccess(
      res,
      '🛒 PayPal order created. Redirect user to approvalUrl.',
      result,
      201,
    );
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/payments/paypal/capture/:orderId */
export async function captureOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());
    const payment = await service.captureOrder(
      userId,
      req.params.orderId as string,
    );
    sendSuccess(
      res,
      '🎉 PayPal payment captured! Subscription activated.',
      payment,
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/payments/paypal/history */
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
      `✅ Retrieved ${payments.length} PayPal payment(s).`,
      payments,
      200,
      meta,
    );
  } catch (err) {
    next(err);
  }
}
