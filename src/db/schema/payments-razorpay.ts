import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
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

export const razorpayStatusEnum = pgEnum('razorpay_payment_status', [
  'pending',
  'authorized',
  'captured',
  'failed',
  'refunded',
]);

// 💳 Razorpay Payments Table

export const razorpayPayments = pgTable(
  'razorpay_payments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    userId: uuid('user_id').notNull(),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => tiers.id, { onDelete: 'restrict' }),

    status: razorpayStatusEnum('status').notNull().default('pending'),

    /** Razorpay Order ID — e.g. order_xxxxx */
    razorpayOrderId: varchar('razorpay_order_id', { length: 100 })
      .notNull()
      .unique(),

    /** Razorpay Payment ID — filled after payment */
    razorpayPaymentId: varchar('razorpay_payment_id', { length: 100 }),

    /** HMAC-SHA256 signature for verification */
    razorpaySignature: varchar('razorpay_signature', { length: 256 }),

    /** Amount in paise (INR subunit) — e.g. 49900 = ₹499 */
    amount: integer('amount').notNull(),

    currency: varchar('currency', { length: 10 }).notNull().default('INR'),

    discountId: uuid('discount_id').references(() => discounts.id, {
      onDelete: 'set null',
    }),

    /** Any additional Razorpay notes or metadata */
    notes: jsonb('notes').$type<Record<string, string>>(),

    failureReason: text('failure_reason'),

    /** Total amount refunded so far (sum of all partial refunds) in paise */
    refundedAmount: integer('refunded_amount'),

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
    index('idx_rzp_user').on(t.userId),
    index('idx_rzp_status').on(t.status),
    index('idx_rzp_order_id').on(t.razorpayOrderId),
  ],
);

export type RazorpayPayment = typeof razorpayPayments.$inferSelect;
export type NewRazorpayPayment = typeof razorpayPayments.$inferInsert;
