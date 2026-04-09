import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  text,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

//  Enums

export const refundStatusEnum = pgEnum('refund_status', [
  'pending',
  'processed',
  'failed',
]);

export const refundProviderEnum = pgEnum('refund_provider', [
  'razorpay',
  'stripe',
  'paypal',
]);

export const refundInitiatorEnum = pgEnum('refund_initiator', [
  'admin',
  'webhook',
]);

// 💰 Refunds Table

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** Cross-service user reference (no physical FK) */
    userId: uuid('user_id').notNull(),

    /**
     * UUID of the row in the provider-specific payment table
     * (razorpay_payments / stripe_payments / paypal_payments)
     */
    paymentId: uuid('payment_id').notNull(),

    provider: refundProviderEnum('provider').notNull(),

    /**
     * Provider-issued refund ID:
     *  - Razorpay: rfnd_xxx
     *  - Stripe:   re_xxx
     *  - PayPal:   capture refund ID
     */
    providerRefundId: varchar('provider_refund_id', { length: 255 }),

    /** Refunded amount in provider's smallest unit (paise / cents) */
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),

    currency: varchar('currency', { length: 10 }).notNull().default('INR'),

    /** true if refundedAmount < original payment amount */
    isPartial: boolean('is_partial').notNull().default(false),

    reason: varchar('reason', { length: 255 }),

    status: refundStatusEnum('status').notNull().default('pending'),

    initiatedBy: refundInitiatorEnum('initiated_by').notNull().default('admin'),

    /** Internal admin notes */
    notes: text('notes'),

    /** Raw provider refund payload — useful for disputes */
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_refunds_user_id').on(t.userId),
    index('idx_refunds_payment_id').on(t.paymentId),
    index('idx_refunds_provider').on(t.provider),
    index('idx_refunds_status').on(t.status),
    index('idx_refunds_created_at').on(t.createdAt),
  ],
);

export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
