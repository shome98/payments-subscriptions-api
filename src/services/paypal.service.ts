import { eq, count, desc } from 'drizzle-orm';
import {
  db,
  paypalPayments,
  tiers,
  paymentAuditLog,
  type PaypalPayment,
} from '../db';
import { ApiError } from '../utils/api-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import { validateDiscount } from './discount.service';
import { resetLimit } from './subscription.service';
import { env } from '../config/env';
import type {
  CreatePaypalOrderDto,
  PaymentHistoryDto,
} from '../validators/payment.validator';

//  PayPal HTTP client

interface PayPalAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

async function getPayPalAccessToken(): Promise<string> {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw ApiError.internal('💥 PayPal is not configured.');
  }
  const credentials = Buffer.from(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`,
  ).toString('base64');

  const response = await fetch(`${env.PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw ApiError.internal('💥 Failed to get PayPal access token.');
  }

  const data = (await response.json()) as PayPalAccessTokenResponse;
  return data.access_token;
}

//  Service

export async function createOrder(
  userId: string,
  dto: CreatePaypalOrderDto,
): Promise<{ payment: PaypalPayment; approvalUrl: string }> {
  const [tier] = await db
    .select()
    .from(tiers)
    .where(eq(tiers.id, dto.tierId))
    .limit(1);

  if (!tier || !tier.isActive)
    throw ApiError.notFound('🔍 Tier not found or inactive.');

  let amount = Number(tier.price);
  let discountId: string | undefined;

  if (dto.discountCode) {
    const { discount } = await validateDiscount({
      code: dto.discountCode,
      tierId: dto.tierId,
    });
    amount = Number(discount.finalPrice);
    discountId = discount.id;
  }

  const accessToken = await getPayPalAccessToken();
  const currency = dto.currency ?? 'USD';

  const orderRes = await fetch(`${env.PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: currency, value: amount.toFixed(2) },
          description: `${tier.name} subscription`,
          custom_id: JSON.stringify({ userId, tierId: dto.tierId }),
        },
      ],
      application_context: {
        brand_name: 'CrudFactory',
        user_action: 'PAY_NOW',
      },
    }),
  });

  if (!orderRes.ok) {
    throw ApiError.internal('💥 Failed to create PayPal order.');
  }

  const orderData = (await orderRes.json()) as {
    id: string;
    links: { rel: string; href: string }[];
  };
  const approvalLink = orderData.links.find((l) => l.rel === 'approve');
  if (!approvalLink)
    throw ApiError.internal('💥 PayPal approval URL not found.');

  const [payment] = await db
    .insert(paypalPayments)
    .values({
      userId,
      tierId: dto.tierId,
      paypalOrderId: orderData.id,
      amount: String(amount),
      currency,
      discountId: discountId ?? null,
      status: 'pending',
    })
    .returning();

  await db.insert(paymentAuditLog).values({
    userId,
    paymentId: payment.id,
    provider: 'paypal',
    action: 'created',
    newStatus: 'pending',
    payload: { orderId: orderData.id, amount },
  });

  return { payment, approvalUrl: approvalLink.href };
}

export async function captureOrder(
  userId: string,
  paypalOrderId: string,
): Promise<PaypalPayment> {
  const accessToken = await getPayPalAccessToken();

  const captureRes = await fetch(
    `${env.PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!captureRes.ok) {
    const errBody = (await captureRes.json()) as { message?: string };
    throw ApiError.badRequest(
      `❌ PayPal capture failed: ${errBody?.message ?? 'unknown error'}`,
    );
  }

  const captureData = (await captureRes.json()) as {
    status: string;
    purchase_units: { payments: { captures: { id: string }[] } }[];
    payer: { payer_id: string };
  };

  if (captureData.status !== 'COMPLETED') {
    throw ApiError.badRequest('❌ PayPal payment not completed.');
  }

  const captureId = captureData.purchase_units[0]?.payments?.captures?.[0]?.id;
  const payerId = captureData.payer?.payer_id;

  const [payment] = await db
    .select()
    .from(paypalPayments)
    .where(eq(paypalPayments.paypalOrderId, paypalOrderId))
    .limit(1);

  if (!payment) throw ApiError.notFound('🔍 PayPal payment record not found.');
  if (payment.status === 'completed')
    throw ApiError.conflict('⚠️ Payment already captured.');

  const previousStatus = payment.status;

  const [updated] = await db
    .update(paypalPayments)
    .set({
      status: 'completed',
      paypalCaptureId: captureId ?? null,
      paypalPayerId: payerId ?? null,
      metadata: captureData as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(paypalPayments.id, payment.id))
    .returning();

  await db.insert(paymentAuditLog).values({
    userId: payment.userId,
    paymentId: payment.id,
    provider: 'paypal',
    action: 'captured',
    previousStatus,
    newStatus: 'completed',
    payload: { captureId, payerId },
  });

  await resetLimit(payment.userId, payment.tierId);

  await db.insert(paymentAuditLog).values({
    userId: payment.userId,
    provider: 'paypal',
    action: 'subscription_activated',
    note: `Activated via PayPal capture ${captureId}`,
  });

  return updated;
}

export async function getPaymentHistory(
  userId: string,
  query: PaymentHistoryDto,
): Promise<{ payments: PaypalPayment[]; meta: Record<string, unknown> }> {
  const { page, limit, offset } = parsePagination(query);

  const [{ total }] = await db
    .select({ total: count() })
    .from(paypalPayments)
    .where(eq(paypalPayments.userId, userId));

  const rows = await db
    .select()
    .from(paypalPayments)
    .where(eq(paypalPayments.userId, userId))
    .orderBy(desc(paypalPayments.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    payments: rows,
    meta: buildPaginationMeta(Number(total), page, limit),
  };
}
