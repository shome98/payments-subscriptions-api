import { Request, Response, NextFunction } from 'express';
import * as service from '../services/webhook.service';
import { sendSuccess, sendError } from '../utils/api-response';

/** POST /api/v1/webhooks/razorpay */
export async function razorpayWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature) {
      sendError(res, '❌ Missing Razorpay signature.', 400);
      return;
    }
    const rawBody =
      (req as Request & { rawBody?: string }).rawBody ??
      JSON.stringify(req.body);
    await service.handleRazorpayWebhook(
      rawBody,
      signature,
      req.body as Record<string, unknown>,
    );
    sendSuccess(res, '✅ Razorpay webhook processed.');
  } catch (err) {
    // Always 200 to Razorpay to prevent retries on logic errors
    console.error('🪝 Razorpay webhook error:', err);
    res.status(200).json({ received: true, error: String(err) });
  }
}

/** POST /api/v1/webhooks/stripe */
export async function stripeWebhook(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      sendError(res, '❌ Missing Stripe signature.', 400);
      return;
    }
    // req.body must be raw Buffer for Stripe signature verification
    await service.handleStripeWebhook(req.body as Buffer, signature);
    sendSuccess(res, '✅ Stripe webhook processed.');
  } catch (err) {
    console.error('🪝 Stripe webhook error:', err);
    res.status(400).json({ received: false, error: String(err) });
  }
}

/** POST /api/v1/webhooks/paypal */
export async function paypalWebhook(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    await service.handlePaypalWebhook(req.body as Record<string, unknown>);
    sendSuccess(res, '✅ PayPal webhook processed.');
  } catch (err) {
    console.error('🪝 PayPal webhook error:', err);
    res.status(200).json({ received: true, error: String(err) });
  }
}
