import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  numeric,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tiers } from './tiers';

// 🏷️ Discounts Table

export const discounts = pgTable(
  'discounts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** The tier this discount applies to */
    tierId: uuid('tier_id')
      .notNull()
      .references(() => tiers.id, { onDelete: 'cascade' }),

    /** Promo code, e.g. "LAUNCH50", "ANNUAL20" */
    code: varchar('code', { length: 50 }).notNull().unique(),

    /** Percentage off, e.g. 20.00 = 20% */
    discountPercentage: numeric('discount_percentage', {
      precision: 5,
      scale: 2,
    }).notNull(),

    /** Pre-computed final price after discount (for quick display) */
    finalPrice: numeric('final_price', { precision: 10, scale: 2 }).notNull(),

    validFrom: timestamp('valid_from', { withTimezone: true })
      .notNull()
      .defaultNow(),
    validUntil: timestamp('valid_until', { withTimezone: true }),

    /** 0 = unlimited */
    maxUses: integer('max_uses').notNull().default(0),
    usedCount: integer('used_count').notNull().default(0),

    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_discounts_tier').on(t.tierId),
    index('idx_discounts_code').on(t.code),
    index('idx_discounts_active').on(t.isActive),
  ],
);

export type Discount = typeof discounts.$inferSelect;
export type NewDiscount = typeof discounts.$inferInsert;
