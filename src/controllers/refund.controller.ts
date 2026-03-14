import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/api-response';
import {
  initiateRazorpayRefund,
  initiateStripeRefund,
  initiatePaypalRefund,
  getAllRefunds,
  getUserRefunds,
  getRefundById,
} from '../services/refund.service';
import type {
  InitiateRefundDto,
  RefundHistoryDto,
} from '../validators/refund.validator';

//  Admin: Initiate refunds

export async function adminRefundRazorpay(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const adminId = req.user!.userId;
    const { paymentId } = req.params;
    const dto = req.body as InitiateRefundDto;
    const refund = await initiateRazorpayRefund(
      adminId,
      paymentId as string,
      dto,
    );
    sendSuccess(
      res,
      '✅ Razorpay refund initiated successfully.',
      { refund },
      201,
    );
  } catch (err) {
    next(err);
  }
}

export async function adminRefundStripe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const adminId = req.user!.userId;
    const { paymentId } = req.params;
    const dto = req.body as InitiateRefundDto;
    const refund = await initiateStripeRefund(
      adminId,
      paymentId as string,
      dto,
    );
    sendSuccess(
      res,
      '✅ Stripe refund initiated successfully.',
      { refund },
      201,
    );
  } catch (err) {
    next(err);
  }
}

export async function adminRefundPaypal(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const adminId = req.user!.userId;
    const { paymentId } = req.params;
    const dto = req.body as InitiateRefundDto;
    const refund = await initiatePaypalRefund(
      adminId,
      paymentId as string,
      dto,
    );
    sendSuccess(
      res,
      '✅ PayPal refund initiated successfully.',
      { refund },
      201,
    );
  } catch (err) {
    next(err);
  }
}

//  Admin: List all refunds

export async function adminListRefunds(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as RefundHistoryDto;
    const result = await getAllRefunds(query);
    sendSuccess(res, '✅ Refunds fetched.', result);
  } catch (err) {
    next(err);
  }
}

//  Admin: Get single refund

export async function adminGetRefund(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const refund = await getRefundById(req.params.refundId as string);
    sendSuccess(res, '✅ Refund fetched.', { refund });
  } catch (err) {
    next(err);
  }
}

//  User: Own refund history

export async function myRefunds(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const query = req.query as unknown as RefundHistoryDto;
    const result = await getUserRefunds(userId, query);
    sendSuccess(res, '✅ Your refund history.', result);
  } catch (err) {
    next(err);
  }
}
