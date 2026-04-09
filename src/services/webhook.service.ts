import { eq, and } from 'drizzle-orm';
import {
  db,
  webhookEvents,
  razorpayPayments,
  stripePayments,
  paypalPayments,
  paymentAuditLog,
  refunds,
} from '../db';
import { verifyRazorpayWebhookSignature } from '../utils/crypto';
import { resetLimit } from './subscription.service';
import { processWebhookRefund } from './refund.service';
import { env } from '../config/env';

//  Idempotency Guard

async function isAlreadyProcessed(
  provider: 'razorpay' | 'stripe' | 'paypal',
  eventId: string,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.provider, provider),
        eq(webhookEvents.eventId, eventId),
      ),
    )
    .limit(1);
  return Boolean(existing);
}

async function markProcessed(
  provider: 'razorpay' | 'stripe' | 'paypal',
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>,
  status: 'processed' | 'failed' | 'ignored' = 'processed',
  errorMessage?: string,
): Promise<void> {
  await db
    .insert(webhookEvents)
    .values({
      provider,
      eventId,
      eventType,
      status,
      payload,
      errorMessage: errorMessage ?? null,
    })
    .onConflictDoNothing();
}

//  Razorpay Webhook

export async function handleRazorpayWebhook(
  rawBody: string,
  signature: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error('Razorpay webhook secret not configured.');
  }

  const isValid = verifyRazorpayWebhookSignature(
    rawBody,
    signature,
    env.RAZORPAY_WEBHOOK_SECRET,
  );

  if (!isValid) throw new Error('Invalid Razorpay webhook signature.');

  const eventType = payload.event as string;
  const entity =
    (payload.payload as { payment?: { entity?: Record<string, unknown> } })
      ?.payment?.entity ?? {};
  const orderId = entity.order_id as string;
  const paymentId = entity.id as string;
  const eventId = `${eventType}_${orderId}_${paymentId}`;

  if (await isAlreadyProcessed('razorpay', eventId)) return;

  try {
    if (eventType === 'payment.captured') {
      const [payment] = await db
        .select()
        .from(razorpayPayments)
        .where(eq(razorpayPayments.razorpayOrderId, orderId))
        .limit(1);

      if (payment && payment.status !== 'captured') {
        await db
          .update(razorpayPayments)
          .set({
            status: 'captured',
            razorpayPaymentId: paymentId,
            updatedAt: new Date(),
          })
          .where(eq(razorpayPayments.id, payment.id));

        await db.insert(paymentAuditLog).values({
          userId: payment.userId,
          paymentId: payment.id,
          provider: 'razorpay',
          action: 'captured',
          previousStatus: 'authorized',
          newStatus: 'captured',
          note: 'Via webhook',
          payload: entity as Record<string, unknown>,
        });

        await resetLimit(payment.userId, payment.tierId);
      }
    } else if (eventType === 'payment.failed') {
      const [payment] = await db
        .select()
        .from(razorpayPayments)
        .where(eq(razorpayPayments.razorpayOrderId, orderId))
        .limit(1);

      if (payment) {
        await db
          .update(razorpayPayments)
          .set({
            status: 'failed',
            failureReason:
              (entity.error_description as string) ?? 'Payment failed',
            updatedAt: new Date(),
          })
          .where(eq(razorpayPayments.id, payment.id));

        await db.insert(paymentAuditLog).values({
          userId: payment.userId,
          paymentId: payment.id,
          provider: 'razorpay',
          action: 'failed',
          newStatus: 'failed',
          note: 'Via webhook',
          payload: entity as Record<string, unknown>,
        });
      }
    } else if (
      eventType === 'refund.created' ||
      eventType === 'refund.processed'
    ) {
      // Razorpay refund entity is at payload.payload.refund.entity
      const refundEntity =
        (
          payload.payload as {
            refund?: { entity?: Record<string, unknown> };
          }
        )?.refund?.entity ?? {};

      const rzpPaymentId = refundEntity.payment_id as string;
      const providerRefundId = refundEntity.id as string;
      const refundAmount = refundEntity.amount as number;

      if (rzpPaymentId && providerRefundId && refundAmount) {
        const [payment] = await db
          .select()
          .from(razorpayPayments)
          .where(eq(razorpayPayments.razorpayPaymentId, rzpPaymentId))
          .limit(1);

        if (payment) {
          // Update payment table refund fields
          const alreadyRefunded = payment.refundedAmount ?? 0;
          const totalRefunded = Number(alreadyRefunded) + refundAmount;
          const isPartial = totalRefunded < payment.amount;
          await db
            .update(razorpayPayments)
            .set({
              status: 'refunded',
              refundedAmount: totalRefunded,
              refundedAt: payment.refundedAt ?? new Date(),
              isPartialRefund: isPartial,
              updatedAt: new Date(),
            })
            .where(eq(razorpayPayments.id, payment.id));

          await processWebhookRefund({
            userId: payment.userId,
            paymentId: payment.id,
            provider: 'razorpay',
            providerRefundId,
            amount: refundAmount,
            currency: payment.currency,
            originalAmount: payment.amount,
            metadata: refundEntity,
            discountId: payment.discountId,
          });
        }
      }
    } else if (eventType === 'refund.failed') {
      const refundEntity =
        (
          payload.payload as {
            refund?: { entity?: Record<string, unknown> };
          }
        )?.refund?.entity ?? {};
      const providerRefundId = refundEntity.id as string;
      if (providerRefundId) {
        await db
          .update(refunds)
          .set({ status: 'failed' })
          .where(eq(refunds.providerRefundId, providerRefundId));
      }
    }

    await markProcessed('razorpay', eventId, eventType, payload);
  } catch (err) {
    await markProcessed(
      'razorpay',
      eventId,
      eventType,
      payload,
      'failed',
      String(err),
    );
    throw err;
  }
}

//  Stripe Webhook

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string,
): Promise<void> {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook not configured.');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require('stripe');
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
  });

  let event: {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  };
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new Error('Invalid Stripe webhook signature.');
  }

  if (await isAlreadyProcessed('stripe', event.id)) return;

  const obj = event.data.object;

  try {
    if (event.type === 'checkout.session.completed') {
      const sessionId = obj.id as string;
      const paymentStatus = obj.payment_status as string;

      if (paymentStatus === 'paid') {
        const [payment] = await db
          .select()
          .from(stripePayments)
          .where(eq(stripePayments.stripeSessionId, sessionId))
          .limit(1);

        if (payment && payment.status !== 'succeeded') {
          await db
            .update(stripePayments)
            .set({
              status: 'succeeded',
              stripePaymentIntentId: (obj.payment_intent as string) ?? null,
              stripeCustomerId: (obj.customer as string) ?? null,
              updatedAt: new Date(),
            })
            .where(eq(stripePayments.id, payment.id));

          await db.insert(paymentAuditLog).values({
            userId: payment.userId,
            paymentId: payment.id,
            provider: 'stripe',
            action: 'succeeded',
            newStatus: 'succeeded',
            note: 'Via webhook',
          });

          await resetLimit(payment.userId, payment.tierId);
        }
      }
    } else if (event.type === 'charge.refunded') {
      const paymentIntentId = obj.payment_intent as string;
      if (paymentIntentId) {
        const [payment] = await db
          .select()
          .from(stripePayments)
          .where(eq(stripePayments.stripePaymentIntentId, paymentIntentId))
          .limit(1);

        if (payment) {
          // obj.amount_refunded is total refunded so far in cents
          const amountRefunded = obj.amount_refunded as number;
          const originalAmount = (obj.amount as number) ?? payment.amount;
          const isPartial = amountRefunded < originalAmount;

          // Latest refund object in the charge
          const latestRefund = (
            obj.refunds as { data?: Array<{ id: string }> } | undefined
          )?.data?.[0];

          await db
            .update(stripePayments)
            .set({
              status: 'refunded',
              refundedAmount: amountRefunded,
              refundedAt: payment.refundedAt ?? new Date(),
              isPartialRefund: isPartial,
              updatedAt: new Date(),
            })
            .where(eq(stripePayments.id, payment.id));

          if (latestRefund?.id) {
            await processWebhookRefund({
              userId: payment.userId,
              paymentId: payment.id,
              provider: 'stripe',
              providerRefundId: latestRefund.id,
              amount: amountRefunded,
              currency: (obj.currency as string) ?? payment.currency,
              originalAmount,
              metadata: obj,
              discountId: payment.discountId,
            });
          } else {
            // Fallback: no refund object in payload, just log audit
            await db.insert(paymentAuditLog).values({
              userId: payment.userId,
              paymentId: payment.id,
              provider: 'stripe',
              action: 'refunded',
              newStatus: 'refunded',
              note: 'Via webhook (no refund ID in payload)',
            });
          }
        }
      }
    }

    await markProcessed('stripe', event.id, event.type, obj);
  } catch (err) {
    await markProcessed(
      'stripe',
      event.id,
      event.type,
      obj,
      'failed',
      String(err),
    );
    throw err;
  }
}

//  PayPal Webhook

export async function handlePaypalWebhook(
  payload: Record<string, unknown>,
): Promise<void> {
  const eventId = payload.id as string;
  const eventType = payload.event_type as string;
  const resource = payload.resource as Record<string, unknown>;

  if (!eventId) throw new Error('Missing PayPal event ID.');
  if (await isAlreadyProcessed('paypal', eventId)) return;

  try {
    if (
      eventType === 'CHECKOUT.ORDER.APPROVED' ||
      eventType === 'PAYMENT.CAPTURE.COMPLETED'
    ) {
      const orderId =
        (resource.id as string) ??
        (
          resource.supplementary_data as
            | { related_ids?: { order_id?: string } }
            | undefined
        )?.related_ids?.order_id;

      if (orderId) {
        const [payment] = await db
          .select()
          .from(paypalPayments)
          .where(eq(paypalPayments.paypalOrderId, orderId))
          .limit(1);

        if (payment && payment.status !== 'completed') {
          await db
            .update(paypalPayments)
            .set({
              status: 'completed',
              paypalCaptureId: (resource.id as string) ?? null,
              metadata: resource,
              updatedAt: new Date(),
            })
            .where(eq(paypalPayments.id, payment.id));

          await db.insert(paymentAuditLog).values({
            userId: payment.userId,
            paymentId: payment.id,
            provider: 'paypal',
            action: 'captured',
            newStatus: 'completed',
            note: 'Via webhook',
          });

          await resetLimit(payment.userId, payment.tierId);
        }
      }
    } else if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      // resource.id is the refund capture ID
      // resource.amount is { value: "10.00", currency_code: "USD" }
      // resource.links contains the original capture link
      const providerRefundId = resource.id as string;
      const refundAmountStr = (
        resource.amount as { value?: string } | undefined
      )?.value;
      const currency =
        (resource.amount as { currency_code?: string } | undefined)
          ?.currency_code ?? 'USD';

      if (providerRefundId && refundAmountStr) {
        // Find original capture ID from the refund's links
        const links = resource.links as
          | Array<{ rel: string; href: string }>
          | undefined;
        const captureLink = links?.find((l) => l.rel === 'up')?.href;
        const captureId = captureLink?.split('/').pop();

        if (captureId) {
          const [payment] = await db
            .select()
            .from(paypalPayments)
            .where(eq(paypalPayments.paypalCaptureId, captureId))
            .limit(1);

          if (payment) {
            const refundAmount = parseFloat(refundAmountStr);
            const originalAmount = Number(payment.amount);
            const alreadyRefunded = payment.refundedAmount
              ? Number(payment.refundedAmount)
              : 0;
            const totalRefunded = alreadyRefunded + refundAmount;
            const isPartial = totalRefunded < originalAmount;

            await db
              .update(paypalPayments)
              .set({
                status: 'refunded',
                refundedAmount: String(totalRefunded),
                refundedAt: payment.refundedAt ?? new Date(),
                isPartialRefund: isPartial,
                updatedAt: new Date(),
              })
              .where(eq(paypalPayments.id, payment.id));

            await processWebhookRefund({
              userId: payment.userId,
              paymentId: payment.id,
              provider: 'paypal',
              providerRefundId,
              amount: refundAmount,
              currency,
              originalAmount,
              metadata: resource,
              discountId: payment.discountId,
            });
          }
        }
      }
    }

    await markProcessed('paypal', eventId, eventType, payload);
  } catch (err) {
    await markProcessed(
      'paypal',
      eventId,
      eventType,
      payload,
      'failed',
      String(err),
    );
    throw err;
  }
}
