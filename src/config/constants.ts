//  API versioning
export const API_PREFIX = '/api/v1';

//  Default free tier
export const FREE_TIER_NAME = 'Free';
export const FREE_TIER_LIMIT = 3; // APIs a free user can create

//  Pagination
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

//  Payment providers
export const PAYMENT_PROVIDERS = ['razorpay', 'stripe', 'paypal'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

//  Subscription statuses
export const SUBSCRIPTION_ACTIVE = 'active';
export const SUBSCRIPTION_EXPIRED = 'expired';
export const SUBSCRIPTION_CANCELLED = 'cancelled';

//  Webhook idempotency window
// Events older than this are still checked (never replayed)
export const WEBHOOK_IDEMPOTENCY_WINDOW_DAYS = 30;
