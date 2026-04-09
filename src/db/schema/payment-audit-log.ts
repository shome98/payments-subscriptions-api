import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { PaymentProvider } from '../../config/constants';

//  Enums

export const auditActionEnum = pgEnum('payment_audit_action', [
  'created',
  'authorized',
  'captured',
  'succeeded',
  'failed',
  'refunded',
  'cancelled',
  'subscription_activated',
  'subscription_cancelled',
  'subscription_renewed',
  'limit_decremented',
  'limit_reset',
]);

// 📋 Payment Audit Log (append-only, never update/delete)

export const paymentAuditLog = pgTable(
  'payment_audit_log',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    userId: uuid('user_id').notNull(),

    /** ID of the payment record in its respective table */
    paymentId: uuid('payment_id'),

    /** Which payment provider this event is from */
    provider: varchar('provider', { length: 20 })
      .$type<PaymentProvider | 'internal'>()
      .notNull(),

    action: auditActionEnum('action').notNull(),

    /** Previous status snapshot */
    previousStatus: varchar('previous_status', { length: 50 }),

    /** New status after this event */
    newStatus: varchar('new_status', { length: 50 }),

    /** Raw webhook payload or event context (useful for disputes) */
    payload: jsonb('payload').$type<Record<string, unknown>>(),

    note: text('note'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_audit_user').on(t.userId),
    index('idx_audit_payment').on(t.paymentId),
    index('idx_audit_provider').on(t.provider),
    index('idx_audit_action').on(t.action),
    index('idx_audit_created_at').on(t.createdAt),
  ],
);

export type PaymentAuditLog = typeof paymentAuditLog.$inferSelect;
export type NewPaymentAuditLog = typeof paymentAuditLog.$inferInsert;
