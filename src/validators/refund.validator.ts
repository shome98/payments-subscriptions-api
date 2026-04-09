import { z } from 'zod';

//  Initiate Refund (admin)

export const InitiateRefundSchema = z.object({
  body: z.object({
    /** Omit for a full refund */
    amount: z
      .number({ error: 'Amount must be a number.' })
      .positive({ error: 'Amount must be positive.' })
      .optional(),
    reason: z
      .string()
      .max(255, 'Reason must be at most 255 characters.')
      .optional(),
    notes: z.string().optional(),
  }),
});

//  Refund History query (admin + user self)

export const RefundHistorySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 20))
      .pipe(z.number().int().min(1).max(100)),
    provider: z.enum(['razorpay', 'stripe', 'paypal']).optional(),
    status: z.enum(['pending', 'processed', 'failed']).optional(),
  }),
});

export type InitiateRefundDto = z.infer<typeof InitiateRefundSchema>['body'];
export type RefundHistoryDto = z.infer<typeof RefundHistorySchema>['query'];
