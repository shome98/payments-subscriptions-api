import { eq, and, count, desc } from 'drizzle-orm';
import {
  db,
  razorpayPayments,
  tiers,
  paymentAuditLog,
  type RazorpayPayment,
} from '../db';
import { ApiError } from '../utils/api-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import { verifyRazorpaySignature } from '../utils/crypto';
import { validateDiscount } from './discount.service';
import { resetLimit } from './subscription.service';
import { env } from '../config/env';
import type {
  CreateRazorpayOrderDto,
  VerifyRazorpayPaymentDto,
  PaymentHistoryDto,
} from '../validators/payment.validator';

//  Razorpay SDK (lazy import — only used if keys are configured)
async function getRazorpay() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw ApiError.internal('💥 Razorpay is not configured.');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require('razorpay');
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
}

//  Service

export async function createOrder(
  userId: string,
  dto: CreateRazorpayOrderDto,
): Promise<{
  payment: RazorpayPayment;
  razorpayOrder: Record<string, unknown>;
}> {
  const [tier] = await db
    .select({ id: tiers.id, price: tiers.price, name: tiers.name })
    .from(tiers)
    .where(and(eq(tiers.id, dto.tierId), eq(tiers.isActive, true)))
    .limit(1);

  if (!tier) throw ApiError.notFound('🔍 Tier not found or inactive.');

  let amountInPaise = Math.round(Number(tier.price) * 100);
  let discountId: string | undefined;

  if (dto.discountCode) {
    const { discount } = await validateDiscount({
      code: dto.discountCode,
      tierId: dto.tierId,
    });
    amountInPaise = Math.round(Number(discount.finalPrice) * 100);
    discountId = discount.id;
  }

  const rzp = await getRazorpay();
  const rzpOrder = await rzp.orders.create({
    amount: amountInPaise,
    currency: dto.currency ?? 'INR',
    notes: { userId, tierId: dto.tierId, ...dto.notes },
  });

  const [payment] = await db
    .insert(razorpayPayments)
    .values({
      userId,
      tierId: dto.tierId,
      razorpayOrderId: rzpOrder.id,
      amount: amountInPaise,
      currency: dto.currency ?? 'INR',
      discountId: discountId ?? null,
      notes: dto.notes ?? null,
      status: 'pending',
    })
    .returning();

  await db.insert(paymentAuditLog).values({
    userId,
    paymentId: payment.id,
    provider: 'razorpay',
    action: 'created',
    newStatus: 'pending',
    payload: { orderId: rzpOrder.id, amount: amountInPaise },
  });

  return { payment, razorpayOrder: rzpOrder };
}

export async function verifyPayment(
  userId: string,
  dto: VerifyRazorpayPaymentDto,
): Promise<RazorpayPayment> {
  if (!env.RAZORPAY_KEY_SECRET) {
    throw ApiError.internal('💥 Razorpay is not configured.');
  }

  const isValid = verifyRazorpaySignature(
    dto.razorpayOrderId,
    dto.razorpayPaymentId,
    dto.razorpaySignature,
    env.RAZORPAY_KEY_SECRET,
  );

  if (!isValid) {
    throw ApiError.badRequest(
      '❌ Invalid payment signature. Possible tampering detected.',
    );
  }

  const [payment] = await db
    .select()
    .from(razorpayPayments)
    .where(
      and(
        eq(razorpayPayments.razorpayOrderId, dto.razorpayOrderId),
        eq(razorpayPayments.userId, userId),
      ),
    )
    .limit(1);

  if (!payment) throw ApiError.notFound('🔍 Payment record not found.');
  if (payment.status === 'captured') {
    throw ApiError.conflict('⚠️ Payment already verified.');
  }

  const previousStatus = payment.status;

  const [updated] = await db
    .update(razorpayPayments)
    .set({
      status: 'captured',
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
      updatedAt: new Date(),
    })
    .where(eq(razorpayPayments.id, payment.id))
    .returning();

  await db.insert(paymentAuditLog).values({
    userId,
    paymentId: payment.id,
    provider: 'razorpay',
    action: 'captured',
    previousStatus,
    newStatus: 'captured',
    payload: { razorpayPaymentId: dto.razorpayPaymentId },
  });

  // Activate subscription
  await resetLimit(userId, payment.tierId);

  await db.insert(paymentAuditLog).values({
    userId,
    provider: 'razorpay',
    action: 'subscription_activated',
    note: `Activated via Razorpay payment ${dto.razorpayPaymentId}`,
  });

  return updated;
}

export async function getPaymentHistory(
  userId: string,
  query: PaymentHistoryDto,
): Promise<{ payments: RazorpayPayment[]; meta: Record<string, unknown> }> {
  const { page, limit, offset } = parsePagination(query);

  const [{ total }] = await db
    .select({ total: count() })
    .from(razorpayPayments)
    .where(eq(razorpayPayments.userId, userId));

  const rows = await db
    .select()
    .from(razorpayPayments)
    .where(eq(razorpayPayments.userId, userId))
    .orderBy(desc(razorpayPayments.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    payments: rows,
    meta: buildPaginationMeta(Number(total), page, limit),
  };
}
