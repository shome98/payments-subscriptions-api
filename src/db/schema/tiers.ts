import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

//  Enums

export const tierPermissionEnum = pgEnum('tier_permission', [
  'SCRUD',
  'SCRUDQ',
  'MCRUD',
  'MCRUDQ',
]);

// 📦 Tiers Table

export const tiers = pgTable(
  'tiers',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** Display name, e.g. "Free", "Pro", "Enterprise" */
    name: varchar('name', { length: 100 }).notNull().unique(),

    description: text('description'),

    /**
     * Array of benefit strings shown to the user in the client.
     * e.g. ["3 APIs", "Community support", "SCRUD access"]
     */
    benefits: jsonb('benefits')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    /** Price in USD/INR depending on context; stored as decimal */
    price: numeric('price', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),

    /** Maximum number of APIs this tier allows a user to create */
    limit: integer('limit').notNull().default(3),

    /** Monthly request rate limit granted to APIs created under this tier */
    rateLimit: integer('rate_limit').notNull().default(10000),

    /** Permission level granted by this tier */
    permission: tierPermissionEnum('permission').notNull().default('SCRUD'),

    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('idx_tiers_active').on(t.isActive)],
);

export type Tier = typeof tiers.$inferSelect;
export type NewTier = typeof tiers.$inferInsert;
