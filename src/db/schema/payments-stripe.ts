import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tiers } from './tiers';
import { discounts } from './discounts';

//  Enums

export const stripeStatusEnum = pgEnum('stripe_payment_status', [
  'pending',
  'succeeded',
  'failed',
  'refunded',
  'canceled',
]);

// 💳 Stripe Payments Table

export const stripePayments = pgTable(
  'stripe_payments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    userId: uuid('user_id').notNull(),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => tiers.id, { onDelete: 'restrict' }),

    status: stripeStatusEnum('status').notNull().default('pending'),

    /** Stripe Checkout Session ID — cs_test_xxx */
    stripeSessionId: varchar('stripe_session_id', { length: 200 })
      .notNull()
      .unique(),

    /** PaymentIntent ID — pi_xxx */
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 200 }),

    /** Customer ID — cus_xxx (for recurring billing) */
    stripeCustomerId: varchar('stripe_customer_id', { length: 200 }),

    /** Subscription ID — sub_xxx (for recurring plans) */
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 200 }),

    /** Amount in cents — e.g. 4999 = $49.99 */
    amount: integer('amount').notNull(),

    currency: varchar('currency', { length: 10 }).notNull().default('USD'),

    discountId: uuid('discount_id').references(() => discounts.id, {
      onDelete: 'set null',
    }),

    failureMessage: text('failure_message'),

    /** Total amount refunded so far (sum of all partial refunds) in cents */
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
    index('idx_stripe_user').on(t.userId),
    index('idx_stripe_status').on(t.status),
    index('idx_stripe_session').on(t.stripeSessionId),
    index('idx_stripe_customer').on(t.stripeCustomerId),
    index('idx_stripe_subscription').on(t.stripeSubscriptionId),
  ],
);

export type StripePayment = typeof stripePayments.$inferSelect;
export type NewStripePayment = typeof stripePayments.$inferInsert;
