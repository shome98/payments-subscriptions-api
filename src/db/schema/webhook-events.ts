import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

//  Enums

export const webhookProviderEnum = pgEnum('webhook_provider', [
  'razorpay',
  'stripe',
  'paypal',
]);

export const webhookStatusEnum = pgEnum('webhook_status', [
  'processed',
  'failed',
  'ignored',
]);

// 🪝 Webhook Events (idempotency table)

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    provider: webhookProviderEnum('provider').notNull(),

    /** Provider-assigned unique event ID — e.g. evt_xxx (Stripe), pay.captured (Razorpay event+orderId) */
    eventId: varchar('event_id', { length: 300 }).notNull(),

    /** The type/name of the event — e.g. "payment.captured", "charge.succeeded" */
    eventType: varchar('event_type', { length: 100 }).notNull(),

    status: webhookStatusEnum('status').notNull().default('processed'),

    /** Raw webhook payload for debugging / replay */
    payload: jsonb('payload').$type<Record<string, unknown>>(),

    /** Error message if processing failed */
    errorMessage: varchar('error_message', { length: 500 }),

    processedAt: timestamp('processed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('idx_webhook_event_id_unique').on(t.provider, t.eventId),
    index('idx_webhook_provider').on(t.provider),
    index('idx_webhook_status').on(t.status),
  ],
);

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
