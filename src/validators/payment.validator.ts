import { z } from 'zod';

//  Razorpay

export const createRazorpayOrderSchema = z.object({
  tierId: z.uuid('Invalid tier ID'),
  discountCode: z.string().max(50).optional(),
  currency: z.string().length(3).default('INR'),
  notes: z.record(z.string(), z.string()).optional(),
});

export const verifyRazorpayPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

//  Stripe

export const createStripeSessionSchema = z.object({
  tierId: z.uuid('Invalid tier ID'),
  discountCode: z.string().max(50).optional(),
  currency: z.string().length(3).default('USD'),
});

//  PayPal

export const createPaypalOrderSchema = z.object({
  tierId: z.uuid('Invalid tier ID'),
  discountCode: z.string().max(50).optional(),
  currency: z.string().length(3).default('USD'),
});

export const capturePaypalOrderParamSchema = z.object({
  orderId: z.string().min(1, 'Order ID required'),
});

//  Payment history pagination

export const paymentHistorySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
});

//  UUID param

export const uuidParamSchema = z.object({
  id: z.uuid('Invalid UUID'),
});

//  Types

export type CreateRazorpayOrderDto = z.infer<typeof createRazorpayOrderSchema>;
export type VerifyRazorpayPaymentDto = z.infer<
  typeof verifyRazorpayPaymentSchema
>;
export type CreateStripeSessionDto = z.infer<typeof createStripeSessionSchema>;
export type CreatePaypalOrderDto = z.infer<typeof createPaypalOrderSchema>;
export type CapturePaypalOrderParamDto = z.infer<
  typeof capturePaypalOrderParamSchema
>;
export type PaymentHistoryDto = z.infer<typeof paymentHistorySchema>;
