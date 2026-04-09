import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 📊 Subscription Usage Log
// Append-only audit trail for every limitLeft change

export const subscriptionUsageLog = pgTable(
  'subscription_usage_log',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    userId: uuid('user_id').notNull(),

    /** The CrudFactory apiId that triggered the decrement */
    apiId: varchar('api_id', { length: 64 }),

    /** Action: decrement on API creation, reset on renewal/upgrade */
    action: varchar('action', { length: 30 }).notNull().default('decrement'),

    /** limitLeft snapshot BEFORE this action */
    limitBefore: integer('limit_before').notNull(),

    /** limitLeft snapshot AFTER this action */
    limitAfter: integer('limit_after').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_usage_log_user').on(t.userId),
    index('idx_usage_log_created').on(t.createdAt),
  ],
);

export type SubscriptionUsageLog = typeof subscriptionUsageLog.$inferSelect;
export type NewSubscriptionUsageLog = typeof subscriptionUsageLog.$inferInsert;
