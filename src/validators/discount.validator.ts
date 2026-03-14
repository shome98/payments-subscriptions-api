import { z } from 'zod';

//  Create Discount

export const createDiscountSchema = z.object({
  tierId: z.string().uuid('Invalid tier ID'),
  code: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase letters, numbers, _ or -'),
  discountPercentage: z
    .number()
    .min(0.01)
    .max(100, 'Discount cannot exceed 100%')
    .multipleOf(0.01),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  maxUses: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

//  Update Discount

export const updateDiscountSchema = createDiscountSchema
  .omit({ tierId: true, code: true })
  .partial();

//  Validate Discount (public query)

export const validateDiscountQuerySchema = z.object({
  code: z.string().min(1).max(50),
  tierId: z.string().uuid('Invalid tier ID'),
});

//  Params

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID'),
});

//  Types

export type CreateDiscountDto = z.infer<typeof createDiscountSchema>;
export type UpdateDiscountDto = z.infer<typeof updateDiscountSchema>;
export type ValidateDiscountQueryDto = z.infer<
  typeof validateDiscountQuerySchema
>;
export type UuidParamDto = z.infer<typeof uuidParamSchema>;
