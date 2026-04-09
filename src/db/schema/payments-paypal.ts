import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tiers } from './tiers';
import { discounts } from './discounts';

//  Enums

export const paypalStatusEnum = pgEnum('paypal_payment_status', [
  'pending',
  'completed',
  'failed',
  'refunded',
  'cancelled',
]);

// 💳 PayPal Payments Table
export const paypalPayments = pgTable(
  'paypal_payments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    userId: uuid('user_id').notNull(),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => tiers.id, { onDelete: 'restrict' }),

    status: paypalStatusEnum('status').notNull().default('pending'),

    /** PayPal Order ID */
    paypalOrderId: varchar('paypal_order_id', { length: 100 })
      .notNull()
      .unique(),

    /** Capture ID — filled after capture */
    paypalCaptureId: varchar('paypal_capture_id', { length: 100 }),

    /** Payer's PayPal account ID */
    paypalPayerId: varchar('paypal_payer_id', { length: 100 }),

    /** Amount as decimal — PayPal uses string decimals */
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),

    currency: varchar('currency', { length: 10 }).notNull().default('USD'),

    discountId: uuid('discount_id').references(() => discounts.id, {
      onDelete: 'set null',
    }),

    /** Raw PayPal response / additional metadata */
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    failureReason: text('failure_reason'),

    /** Total amount refunded so far as decimal string */
    refundedAmount: numeric('refunded_amount', { precision: 10, scale: 2 }),

    /** Timestamp of the first/latest refund */
    refundedAt: timestamp('refunded_at', { withTimezone: true }),

    /** True if refundedAmount < original amount */
    isPartialRefund: boolean('is_partial_refund').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_paypal_user').on(t.userId),
    index('idx_paypal_status').on(t.status),
    index('idx_paypal_order').on(t.paypalOrderId),
  ],
);

export type PaypalPayment = typeof paypalPayments.$inferSelect;
export type NewPaypalPayment = typeof paypalPayments.$inferInsert;
