import { eq, and, count, desc } from 'drizzle-orm';
import {
  db,
  stripePayments,
  tiers,
  paymentAuditLog,
  type StripePayment,
} from '../db';
import { ApiError } from '../utils/api-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import { validateDiscount } from './discount.service';
import { resetLimit } from './subscription.service';
import { env } from '../config/env';
import type {
  CreateStripeSessionDto,
  PaymentHistoryDto,
} from '../validators/payment.validator';

//  Stripe SDK (lazy import)
async function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw ApiError.internal('💥 Stripe is not configured.');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require('stripe');
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
}

//  Service

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  dto: CreateStripeSessionDto,
): Promise<{ payment: StripePayment; sessionUrl: string }> {
  const [tier] = await db
    .select()
    .from(tiers)
    .where(and(eq(tiers.id, dto.tierId), eq(tiers.isActive, true)))
    .limit(1);

  if (!tier) throw ApiError.notFound('🔍 Tier not found or inactive.');

  let amountInCents = Math.round(Number(tier.price) * 100);
  let discountId: string | undefined;
  let stripeDiscounts: { coupon?: string }[] = [];

  if (dto.discountCode) {
    const { discount } = await validateDiscount({
      code: dto.discountCode,
      tierId: dto.tierId,
    });
    amountInCents = Math.round(Number(discount.finalPrice) * 100);
    discountId = discount.id;
  }

  const stripe = await getStripe();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: dto.currency ?? 'usd',
          product_data: {
            name: tier.name,
            description: tier.description ?? undefined,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: env.STRIPE_CANCEL_URL,
    metadata: { userId, tierId: dto.tierId, discountId: discountId ?? '' },
    discounts: stripeDiscounts,
  });

  const [payment] = await db
    .insert(stripePayments)
    .values({
      userId,
      tierId: dto.tierId,
      stripeSessionId: session.id,
      amount: amountInCents,
      currency: dto.currency ?? 'USD',
      discountId: discountId ?? null,
      status: 'pending',
    })
    .returning();

  await db.insert(paymentAuditLog).values({
    userId,
    paymentId: payment.id,
    provider: 'stripe',
    action: 'created',
    newStatus: 'pending',
    payload: { sessionId: session.id, amount: amountInCents },
  });

  return { payment, sessionUrl: session.url };
}

export async function handleSessionSuccess(
  sessionId: string,
): Promise<StripePayment> {
  const stripe = await getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== 'paid') {
    throw ApiError.badRequest('❌ Payment not completed.');
  }

  const [payment] = await db
    .select()
    .from(stripePayments)
    .where(eq(stripePayments.stripeSessionId, sessionId))
    .limit(1);

  if (!payment) throw ApiError.notFound('🔍 Payment session not found.');
  if (payment.status === 'succeeded') return payment;

  const previousStatus = payment.status;

  const [updated] = await db
    .update(stripePayments)
    .set({
      status: 'succeeded',
      stripePaymentIntentId: (session.payment_intent as string) ?? null,
      stripeCustomerId: (session.customer as string) ?? null,
      updatedAt: new Date(),
    })
    .where(eq(stripePayments.id, payment.id))
    .returning();

  await db.insert(paymentAuditLog).values({
    userId: payment.userId,
    paymentId: payment.id,
    provider: 'stripe',
    action: 'succeeded',
    previousStatus,
    newStatus: 'succeeded',
    payload: { sessionId },
  });

  await resetLimit(payment.userId, payment.tierId);

  await db.insert(paymentAuditLog).values({
    userId: payment.userId,
    provider: 'stripe',
    action: 'subscription_activated',
    note: `Activated via Stripe session ${sessionId}`,
  });

  return updated;
}

export async function getPaymentHistory(
  userId: string,
  query: PaymentHistoryDto,
): Promise<{ payments: StripePayment[]; meta: Record<string, unknown> }> {
  const { page, limit, offset } = parsePagination(query);

  const [{ total }] = await db
    .select({ total: count() })
    .from(stripePayments)
    .where(eq(stripePayments.userId, userId));

  const rows = await db
    .select()
    .from(stripePayments)
    .where(eq(stripePayments.userId, userId))
    .orderBy(desc(stripePayments.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    payments: rows,
    meta: buildPaginationMeta(Number(total), page, limit),
  };
}
