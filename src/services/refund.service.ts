import { eq, and, desc, count } from 'drizzle-orm';
import {
  db,
  refunds,
  razorpayPayments,
  stripePayments,
  paypalPayments,
  paymentAuditLog,
  type Refund,
} from '../db';
import { ApiError } from '../utils/api-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import { downgradeToFree } from './subscription.service';
import { rollbackDiscountUsage } from './discount.service';
import { env } from '../config/env';
import type {
  InitiateRefundDto,
  RefundHistoryDto,
} from '../validators/refund.validator';

//  Helpers

/** Determine if a refund amount constitutes a full refund */
function isFullRefund(refundAmount: number, originalAmount: number): boolean {
  return refundAmount >= originalAmount;
}

//  Razorpay Refund

export async function initiateRazorpayRefund(
  adminId: string,
  paymentId: string,
  dto: InitiateRefundDto,
): Promise<Refund> {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw ApiError.internal('💥 Razorpay is not configured.');
  }

  const [payment] = await db
    .select()
    .from(razorpayPayments)
    .where(eq(razorpayPayments.id, paymentId))
    .limit(1);

  if (!payment) throw ApiError.notFound('🔍 Razorpay payment not found.');
  if (!['captured', 'authorized'].includes(payment.status)) {
    throw ApiError.badRequest(
      `❌ Payment status is "${payment.status}" — only captured/authorized payments can be refunded.`,
    );
  }
  if (!payment.razorpayPaymentId) {
    throw ApiError.badRequest(
      '❌ Payment has no Razorpay payment ID — cannot refund.',
    );
  }

  const refundAmountPaise = dto.amount ?? payment.amount;
  const isPartial = !isFullRefund(refundAmountPaise, payment.amount);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require('razorpay');
  const rzp = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
  const rzpRefund = (await rzp.payments.refund(payment.razorpayPaymentId, {
    amount: refundAmountPaise,
    notes: { reason: dto.reason ?? 'Admin refund', adminId },
  })) as { id: string; status: string };

  // Persist refund record
  const [refund] = await db
    .insert(refunds)
    .values({
      userId: payment.userId,
      paymentId: payment.id,
      provider: 'razorpay',
      providerRefundId: rzpRefund.id,
      amount: String(refundAmountPaise),
      currency: payment.currency,
      isPartial,
      reason: dto.reason ?? null,
      status: rzpRefund.status === 'processed' ? 'processed' : 'pending',
      initiatedBy: 'admin',
      notes: dto.notes ?? null,
      metadata: rzpRefund as unknown as Record<string, unknown>,
    })
    .returning();

  // Update payment table
  const alreadyRefunded = payment.refundedAmount ?? 0;
  const totalRefunded = Number(alreadyRefunded) + refundAmountPaise;
  await db
    .update(razorpayPayments)
    .set({
      refundedAmount: totalRefunded,
      refundedAt: payment.refundedAt ?? new Date(),
      isPartialRefund: isPartial,
      status: isPartial ? 'refunded' : 'refunded',
      updatedAt: new Date(),
    })
    .where(eq(razorpayPayments.id, payment.id));

  // Audit log
  await db.insert(paymentAuditLog).values({
    userId: payment.userId,
    paymentId: payment.id,
    provider: 'razorpay',
    action: 'refunded',
    previousStatus: payment.status,
    newStatus: 'refunded',
    note: `${isPartial ? 'Partial' : 'Full'} refund of ${refundAmountPaise} paise. Reason: ${dto.reason ?? 'N/A'}`,
    payload: rzpRefund as unknown as Record<string, unknown>,
  });

  // Side effects for full refund
  if (!isPartial) {
    await downgradeToFree(payment.userId, payment.id, 'razorpay');
    if (payment.discountId) {
      await rollbackDiscountUsage(payment.discountId);
    }
  }

  return refund;
}

//  Stripe Refund

export async function initiateStripeRefund(
  adminId: string,
  paymentId: string,
  dto: InitiateRefundDto,
): Promise<Refund> {
  if (!env.STRIPE_SECRET_KEY) {
    throw ApiError.internal('💥 Stripe is not configured.');
  }

  const [payment] = await db
    .select()
    .from(stripePayments)
    .where(eq(stripePayments.id, paymentId))
    .limit(1);

  if (!payment) throw ApiError.notFound('🔍 Stripe payment not found.');
  if (payment.status !== 'succeeded') {
    throw ApiError.badRequest(
      `❌ Payment status is "${payment.status}" — only succeeded payments can be refunded.`,
    );
  }
  if (!payment.stripePaymentIntentId) {
    throw ApiError.badRequest(
      '❌ Payment has no PaymentIntent ID — cannot refund.',
    );
  }

  const refundAmountCents = dto.amount ?? payment.amount;
  const isPartial = !isFullRefund(refundAmountCents, payment.amount);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require('stripe');
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
  });

  const stripeRefund = (await stripe.refunds.create({
    payment_intent: payment.stripePaymentIntentId,
    amount: refundAmountCents,
    reason: 'requested_by_customer',
    metadata: { adminId, reason: dto.reason ?? 'Admin refund' },
  })) as { id: string; status: string };

  const [refund] = await db
    .insert(refunds)
    .values({
      userId: payment.userId,
      paymentId: payment.id,
      provider: 'stripe',
      providerRefundId: stripeRefund.id,
      amount: String(refundAmountCents),
      currency: payment.currency,
      isPartial,
      reason: dto.reason ?? null,
      status: stripeRefund.status === 'succeeded' ? 'processed' : 'pending',
      initiatedBy: 'admin',
      notes: dto.notes ?? null,
      metadata: stripeRefund as unknown as Record<string, unknown>,
    })
    .returning();

  const alreadyRefunded = payment.refundedAmount ?? 0;
  const totalRefunded = Number(alreadyRefunded) + refundAmountCents;
  await db
    .update(stripePayments)
    .set({
      refundedAmount: totalRefunded,
      refundedAt: payment.refundedAt ?? new Date(),
      isPartialRefund: isPartial,
      status: 'refunded',
      updatedAt: new Date(),
    })
    .where(eq(stripePayments.id, payment.id));

  await db.insert(paymentAuditLog).values({
    userId: payment.userId,
    paymentId: payment.id,
    provider: 'stripe',
    action: 'refunded',
    previousStatus: payment.status,
    newStatus: 'refunded',
    note: `${isPartial ? 'Partial' : 'Full'} refund of ${refundAmountCents} cents. Reason: ${dto.reason ?? 'N/A'}`,
    payload: stripeRefund as unknown as Record<string, unknown>,
  });

  if (!isPartial) {
    await downgradeToFree(payment.userId, payment.id, 'stripe');
    if (payment.discountId) {
      await rollbackDiscountUsage(payment.discountId);
    }
  }

  return refund;
}

//  PayPal Refund

export async function initiatePaypalRefund(
  adminId: string,
  paymentId: string,
  dto: InitiateRefundDto,
): Promise<Refund> {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw ApiError.internal('💥 PayPal is not configured.');
  }

  const [payment] = await db
    .select()
    .from(paypalPayments)
    .where(eq(paypalPayments.id, paymentId))
    .limit(1);

  if (!payment) throw ApiError.notFound('🔍 PayPal payment not found.');
  if (payment.status !== 'completed') {
    throw ApiError.badRequest(
      `❌ Payment status is "${payment.status}" — only completed payments can be refunded.`,
    );
  }
  if (!payment.paypalCaptureId) {
    throw ApiError.badRequest('❌ Payment has no capture ID — cannot refund.');
  }

  const originalAmount = Number(payment.amount);
  const refundAmount = dto.amount ? dto.amount / 100 : originalAmount; // PayPal uses decimals
  const isPartial = !isFullRefund(refundAmount, originalAmount);

  // Get PayPal access token
  const tokenRes = await fetch(`${env.PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const tokenData = (await tokenRes.json()) as { access_token: string };
  const accessToken = tokenData.access_token;

  const refundBody: Record<string, unknown> = {
    note_to_payer: dto.reason ?? 'Admin refund',
  };
  if (isPartial) {
    refundBody.amount = {
      value: refundAmount.toFixed(2),
      currency_code: payment.currency,
    };
  }

  const refundRes = await fetch(
    `${env.PAYPAL_BASE_URL}/v2/payments/captures/${payment.paypalCaptureId}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(refundBody),
    },
  );
  const paypalRefund = (await refundRes.json()) as {
    id: string;
    status: string;
  };

  if (!refundRes.ok) {
    throw ApiError.badRequest(
      `❌ PayPal refund failed: ${JSON.stringify(paypalRefund)}`,
    );
  }

  const [refund] = await db
    .insert(refunds)
    .values({
      userId: payment.userId,
      paymentId: payment.id,
      provider: 'paypal',
      providerRefundId: paypalRefund.id,
      amount: String(refundAmount),
      currency: payment.currency,
      isPartial,
      reason: dto.reason ?? null,
      status: paypalRefund.status === 'COMPLETED' ? 'processed' : 'pending',
      initiatedBy: 'admin',
      notes: dto.notes ?? null,
      metadata: paypalRefund as unknown as Record<string, unknown>,
    })
    .returning();

  const alreadyRefunded = payment.refundedAmount
    ? Number(payment.refundedAmount)
    : 0;
  const totalRefunded = alreadyRefunded + refundAmount;
  await db
    .update(paypalPayments)
    .set({
      refundedAmount: String(totalRefunded),
      refundedAt: payment.refundedAt ?? new Date(),
      isPartialRefund: isPartial,
      status: 'refunded',
      updatedAt: new Date(),
    })
    .where(eq(paypalPayments.id, payment.id));

  await db.insert(paymentAuditLog).values({
    userId: payment.userId,
    paymentId: payment.id,
    provider: 'paypal',
    action: 'refunded',
    previousStatus: payment.status,
    newStatus: 'refunded',
    note: `${isPartial ? 'Partial' : 'Full'} refund of ${refundAmount} ${payment.currency}. Reason: ${dto.reason ?? 'N/A'}`,
    payload: paypalRefund as unknown as Record<string, unknown>,
  });

  if (!isPartial) {
    await downgradeToFree(payment.userId, payment.id, 'paypal');
    if (payment.discountId) {
      await rollbackDiscountUsage(payment.discountId);
    }
  }

  return refund;
}

//  Webhook-triggered refund record creation

export interface WebhookRefundParams {
  userId: string;
  paymentId: string;
  provider: 'razorpay' | 'stripe' | 'paypal';
  providerRefundId: string;
  amount: number;
  currency: string;
  originalAmount: number;
  metadata?: Record<string, unknown>;
  discountId?: string | null;
}

export async function processWebhookRefund(
  params: WebhookRefundParams,
): Promise<void> {
  const {
    userId,
    paymentId,
    provider,
    providerRefundId,
    amount,
    currency,
    originalAmount,
    metadata,
    discountId,
  } = params;

  const isPartial = !isFullRefund(amount, originalAmount);

  // Check for duplicate refund records (idempotency at refund level)
  const [existing] = await db
    .select({ id: refunds.id })
    .from(refunds)
    .where(
      and(
        eq(refunds.provider, provider),
        eq(refunds.providerRefundId, providerRefundId),
      ),
    )
    .limit(1);

  if (existing) return; // already recorded

  await db.insert(refunds).values({
    userId,
    paymentId,
    provider,
    providerRefundId,
    amount: String(amount),
    currency,
    isPartial,
    status: 'processed',
    initiatedBy: 'webhook',
    metadata: metadata ?? null,
  });

  await db.insert(paymentAuditLog).values({
    userId,
    paymentId,
    provider,
    action: 'refunded',
    newStatus: 'refunded',
    note: `${isPartial ? 'Partial' : 'Full'} refund via webhook. Provider refund ID: ${providerRefundId}`,
    payload: metadata ?? {},
  });

  if (!isPartial) {
    await downgradeToFree(userId, paymentId, provider);
    if (discountId) {
      await rollbackDiscountUsage(discountId);
    }
  }
}

//  Query helpers

export async function getAllRefunds(query: RefundHistoryDto): Promise<{
  refunds: Refund[];
  meta: Record<string, unknown>;
}> {
  const { page, limit, offset } = parsePagination(query);
  const conditions = [];
  if (query.provider) conditions.push(eq(refunds.provider, query.provider));
  if (query.status) conditions.push(eq(refunds.status, query.status));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(refunds)
    .where(whereClause);

  const rows = await db
    .select()
    .from(refunds)
    .where(whereClause)
    .orderBy(desc(refunds.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    refunds: rows,
    meta: buildPaginationMeta(Number(total), page, limit),
  };
}

export async function getUserRefunds(
  userId: string,
  query: RefundHistoryDto,
): Promise<{ refunds: Refund[]; meta: Record<string, unknown> }> {
  const { page, limit, offset } = parsePagination(query);
  const conditions = [eq(refunds.userId, userId)];
  if (query.provider) conditions.push(eq(refunds.provider, query.provider));
  if (query.status) conditions.push(eq(refunds.status, query.status));

  const [{ total }] = await db
    .select({ total: count() })
    .from(refunds)
    .where(and(...conditions));

  const rows = await db
    .select()
    .from(refunds)
    .where(and(...conditions))
    .orderBy(desc(refunds.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    refunds: rows,
    meta: buildPaginationMeta(Number(total), page, limit),
  };
}

export async function getRefundById(id: string): Promise<Refund> {
  const [refund] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.id, id))
    .limit(1);
  if (!refund) throw ApiError.notFound('🔍 Refund not found.');
  return refund;
}
