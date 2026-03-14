import { Request, Response, NextFunction } from 'express';
import * as service from '../services/razorpay.service';
import { sendSuccess } from '../utils/api-response';
import { ApiError } from '../utils/api-error';
import type {
  CreateRazorpayOrderDto,
  VerifyRazorpayPaymentDto,
  PaymentHistoryDto,
} from '../validators/payment.validator';

/** POST /api/v1/payments/razorpay/create-order */
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
      req.body as CreateRazorpayOrderDto,
    );
    sendSuccess(
      res,
      '🛒 Razorpay order created. Proceed to payment.',
      result,
      201,
    );
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/payments/razorpay/verify */
export async function verifyPayment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());
    const payment = await service.verifyPayment(
      userId,
      req.body as VerifyRazorpayPaymentDto,
    );
    sendSuccess(
      res,
      '🎉 Payment verified! Your subscription is now active.',
      payment,
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/payments/razorpay/history */
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
      `✅ Retrieved ${payments.length} Razorpay payment(s).`,
      payments,
      200,
      meta,
    );
  } catch (err) {
    next(err);
  }
}
