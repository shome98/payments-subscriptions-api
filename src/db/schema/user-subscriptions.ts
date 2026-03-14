import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  integer,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tiers } from './tiers';

//  Enums

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'expired',
  'cancelled',
  'pending',
]);

// 👤 User Subscriptions Table

export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** FK to users table in personal-auth-api (cross-service, no physical FK) */
    userId: uuid('user_id').notNull(),

    isSubscribed: boolean('is_subscribed').notNull().default(false),

    /** Current tier — defaults to free tier */
    tierId: uuid('tier_id')
      .notNull()
      .references(() => tiers.id, { onDelete: 'restrict' }),

    status: subscriptionStatusEnum('status').notNull().default('active'),

    /** null = no expiry (e.g. lifetime deals) */
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    /**
     * Remaining API creation slots.
     * Decremented each time user creates an API in CRUD factory.
     * Reset on tier upgrade / subscription renewal.
     */
    limitLeft: integer('limit_left').notNull().default(3),

    /** Whether the subscription auto-renews */
    autoRenew: boolean('auto_renew').notNull().default(false),

    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('idx_user_subscriptions_user_id').on(t.userId),
    index('idx_user_subscriptions_tier').on(t.tierId),
    index('idx_user_subscriptions_status').on(t.status),
  ],
);

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;
