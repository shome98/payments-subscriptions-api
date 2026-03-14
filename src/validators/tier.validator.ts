import { z } from 'zod';

//  Enums

export const TierPermissionEnum = z.enum([
  'SCRUD',
  'SCRUDQ',
  'MCRUD',
  'MCRUDQ',
]);

//  Create Tier

export const createTierSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  benefits: z
    .array(z.string().max(200))
    .min(1, 'At least one benefit required'),
  price: z
    .number()
    .nonnegative('Price must be >= 0')
    .multipleOf(0.01, 'Price must have at most 2 decimal places'),
  limit: z.number().int().positive('Limit must be a positive integer'),
  permission: TierPermissionEnum.default('SCRUD'),
  isActive: z.boolean().default(true),
});

//  Update Tier

export const updateTierSchema = createTierSchema.partial();

//  Params

export const uuidParamSchema = z.object({
  id: z.uuid('Invalid UUID'),
});

export const tiersByIdsSchema = z.object({
  ids: z.array(z.uuid()).min(1, 'Provide at least one ID').max(50),
});

//  Pagination

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  isActive: z
    .string()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined))
    .optional(),
  search: z.string().max(100).optional(),
});

//  Types

export type CreateTierDto = z.infer<typeof createTierSchema>;
export type UpdateTierDto = z.infer<typeof updateTierSchema>;
export type PaginationDto = z.infer<typeof paginationSchema>;
export type TiersByIdsDto = z.infer<typeof tiersByIdsSchema>;
export type UuidParamDto = z.infer<typeof uuidParamSchema>;
