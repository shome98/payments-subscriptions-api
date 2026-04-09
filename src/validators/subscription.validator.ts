import { z } from 'zod';

//  Update subscription (admin)

export const updateSubscriptionSchema = z.object({
  tierId: z.uuid().optional(),
  isSubscribed: z.boolean().optional(),
  status: z.enum(['active', 'expired', 'cancelled', 'pending']).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  autoRenew: z.boolean().optional(),
  limitLeft: z.number().int().nonnegative().optional(),
});

//  Params

export const uuidParamSchema = z.object({
  id: z.uuid('Invalid UUID'),
});

export const userIdParamSchema = z.object({
  userId: z.uuid('Invalid user ID'),
});

//  Pagination

export const subscriptionPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['active', 'expired', 'cancelled', 'pending']).optional(),
  isSubscribed: z
    .string()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined))
    .optional(),
});

//  Types

export type UpdateSubscriptionDto = z.infer<typeof updateSubscriptionSchema>;
export type UuidParamDto = z.infer<typeof uuidParamSchema>;
export type UserIdParamDto = z.infer<typeof userIdParamSchema>;
export type SubscriptionPaginationDto = z.infer<
  typeof subscriptionPaginationSchema
>;
