import { Request, Response, NextFunction } from 'express';
import { eq, count, desc, and } from 'drizzle-orm';
import { db, razorpayPayments, stripePayments, paypalPayments } from '../db';
import { sendSuccess } from '../utils/api-response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import { PAYMENT_PROVIDERS, type PaymentProvider } from '../config/constants';

/** GET /api/v1/admin/payments?provider=stripe&page=1&limit=20 */
export async function adminGetPayments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const provider = req.query.provider as PaymentProvider | undefined;
    const query = req.query as { page?: number; limit?: number };
    const { page, limit, offset } = parsePagination(query);

    if (provider === 'razorpay' || !provider) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(razorpayPayments);
      const rows = await db
        .select()
        .from(razorpayPayments)
        .orderBy(desc(razorpayPayments.createdAt))
        .limit(limit)
        .offset(offset);

      if (provider === 'razorpay') {
        sendSuccess(
          res,
          `✅ Retrieved ${rows.length} Razorpay payment(s).`,
          rows,
          200,
          buildPaginationMeta(Number(total), page, limit),
        );
        return;
      }
    }

    if (provider === 'stripe') {
      const [{ total }] = await db
        .select({ total: count() })
        .from(stripePayments);
      const rows = await db
        .select()
        .from(stripePayments)
        .orderBy(desc(stripePayments.createdAt))
        .limit(limit)
        .offset(offset);
      sendSuccess(
        res,
        `✅ Retrieved ${rows.length} Stripe payment(s).`,
        rows,
        200,
        buildPaginationMeta(Number(total), page, limit),
      );
      return;
    }

    if (provider === 'paypal') {
      const [{ total }] = await db
        .select({ total: count() })
        .from(paypalPayments);
      const rows = await db
        .select()
        .from(paypalPayments)
        .orderBy(desc(paypalPayments.createdAt))
        .limit(limit)
        .offset(offset);
      sendSuccess(
        res,
        `✅ Retrieved ${rows.length} PayPal payment(s).`,
        rows,
        200,
        buildPaginationMeta(Number(total), page, limit),
      );
      return;
    }

    // All providers summary
    const [rzpCount] = await db
      .select({ total: count() })
      .from(razorpayPayments);
    const [stripeCount] = await db
      .select({ total: count() })
      .from(stripePayments);
    const [paypalCount] = await db
      .select({ total: count() })
      .from(paypalPayments);

    sendSuccess(res, '✅ Payment summary across all providers.', {
      razorpay: { total: Number(rzpCount.total) },
      stripe: { total: Number(stripeCount.total) },
      paypal: { total: Number(paypalCount.total) },
    });
  } catch (err) {
    next(err);
  }
}
