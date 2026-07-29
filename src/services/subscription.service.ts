import { eq, and, count, desc } from 'drizzle-orm';
import {
  db,
  userSubscriptions,
  tiers,
  subscriptionUsageLog,
  paymentAuditLog,
  type UserSubscription,
} from '../db';
import { ApiError } from '../utils/api-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import { FREE_TIER_NAME, FREE_TIER_LIMIT } from '../config/constants';
import type {
  UpdateSubscriptionDto,
  SubscriptionPaginationDto,
} from '../validators/subscription.validator';

//  Internal Types

export interface SubscriptionWithTier extends UserSubscription {
  tier: {
    id: string;
    name: string;
    permission: string;
    limit: number;
    rateLimit: number;
    benefits: string[];
    price: string;
  };
}

export interface SubscriptionCheckResult {
  canCreate: boolean;
  limitLeft: number;
  tier: {
    id: string;
    name: string;
    permission: string;
    limit: number;
    rateLimit: number;
  };
  reason?: string;
}

//  Helpers

async function getFreeTierId(): Promise<string> {
  const [freeTier] = await db
    .select({ id: tiers.id })
    .from(tiers)
    .where(eq(tiers.name, FREE_TIER_NAME))
    .limit(1);

  if (!freeTier)
    throw ApiError.internal('💥 Free tier not configured. Contact admin.');
  return freeTier.id;
}

/** Lazily marks a subscription expired if expiresAt has passed */
async function ensureNotExpired(
  sub: UserSubscription,
): Promise<UserSubscription> {
  if (
    sub.status === 'active' &&
    sub.expiresAt &&
    new Date(sub.expiresAt) < new Date()
  ) {
    const freeTierId = await getFreeTierId();
    const [updated] = await db
      .update(userSubscriptions)
      .set({
        status: 'expired',
        isSubscribed: false,
        tierId: freeTierId,
        limitLeft: FREE_TIER_LIMIT,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.id, sub.id))
      .returning();
    return updated;
  }
  return sub;
}

//  Service

/**
 * Upserts a user subscription — creates a free-tier record if none exists.
 * Called automatically on first subscription check.
 */
export async function getOrCreateSubscription(
  userId: string,
): Promise<SubscriptionWithTier> {
  let [sub] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  if (!sub) {
    const freeTierId = await getFreeTierId();
    [sub] = await db
      .insert(userSubscriptions)
      .values({ userId, tierId: freeTierId, limitLeft: FREE_TIER_LIMIT })
      .returning();
  }

  sub = await ensureNotExpired(sub);

  const [tier] = await db
    .select({
      id: tiers.id,
      name: tiers.name,
      permission: tiers.permission,
      limit: tiers.limit,
      rateLimit: tiers.rateLimit,
      benefits: tiers.benefits,
      price: tiers.price,
    })
    .from(tiers)
    .where(eq(tiers.id, sub.tierId))
    .limit(1);

  return { ...sub, tier: tier as SubscriptionWithTier['tier'] };
}

/**
 * Checks if a user can create a new API.
 * Used by CRUD factory via internal endpoint.
 */
export async function checkSubscriptionLimit(
  userId: string,
): Promise<SubscriptionCheckResult> {
  const subWithTier = await getOrCreateSubscription(userId);

  if (subWithTier.status === 'expired' || subWithTier.status === 'cancelled') {
    return {
      canCreate: false,
      limitLeft: 0,
      tier: subWithTier.tier,
      reason: `📛 Your subscription is ${subWithTier.status}. Please renew or upgrade.`,
    };
  }

  if (subWithTier.limitLeft <= 0) {
    return {
      canCreate: false,
      limitLeft: 0,
      tier: subWithTier.tier,
      reason:
        '🚫 You have reached your API creation limit. Please upgrade your plan.',
    };
  }

  return {
    canCreate: true,
    limitLeft: subWithTier.limitLeft,
    tier: subWithTier.tier,
  };
}

/**
 * Decrements the user's API creation limit by 1.
 * Called by CRUD factory after successful API creation.
 */
export async function decrementLimit(
  userId: string,
  apiId?: string,
): Promise<void> {
  const [sub] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  if (!sub) throw ApiError.notFound('🔍 Subscription not found.');
  if (sub.limitLeft <= 0) {
    throw ApiError.forbidden('🚫 API creation limit already exhausted.');
  }

  const limitBefore = sub.limitLeft;
  const limitAfter = limitBefore - 1;

  await db
    .update(userSubscriptions)
    .set({ limitLeft: limitAfter, updatedAt: new Date() })
    .where(eq(userSubscriptions.id, sub.id));

  // Append usage log
  await db.insert(subscriptionUsageLog).values({
    userId,
    apiId: apiId ?? null,
    action: 'decrement',
    limitBefore,
    limitAfter,
  });
}

/**
 * Resets limit to full tier limit (called on subscription renewal / upgrade).
 */
export async function resetLimit(
  userId: string,
  newTierId?: string,
): Promise<void> {
  const [sub] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  if (!sub) throw ApiError.notFound('🔍 Subscription not found.');

  const tierId = newTierId ?? sub.tierId;
  const [tier] = await db
    .select({ limit: tiers.limit })
    .from(tiers)
    .where(eq(tiers.id, tierId))
    .limit(1);

  if (!tier) throw ApiError.notFound('🔍 Tier not found.');

  const limitBefore = sub.limitLeft;

  await db
    .update(userSubscriptions)
    .set({
      limitLeft: tier.limit,
      tierId,
      isSubscribed: true,
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, sub.id));

  await db.insert(subscriptionUsageLog).values({
    userId,
    action: 'reset',
    limitBefore,
    limitAfter: tier.limit,
  });
}

/** Admin: get all subscriptions */
export async function getAllSubscriptions(
  query: SubscriptionPaginationDto,
): Promise<{
  subscriptions: UserSubscription[];
  meta: Record<string, unknown>;
}> {
  const { page, limit, offset } = parsePagination(query);
  const conditions = [];
  if (query.status) conditions.push(eq(userSubscriptions.status, query.status));
  if (query.isSubscribed !== undefined) {
    conditions.push(eq(userSubscriptions.isSubscribed, query.isSubscribed));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(userSubscriptions)
    .where(whereClause);

  const rows = await db
    .select()
    .from(userSubscriptions)
    .where(whereClause)
    .orderBy(desc(userSubscriptions.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    subscriptions: rows,
    meta: buildPaginationMeta(Number(total), page, limit),
  };
}

/** Admin: update subscription */
export async function adminUpdateSubscription(
  id: string,
  dto: UpdateSubscriptionDto,
): Promise<UserSubscription> {
  const [sub] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.id, id))
    .limit(1);

  if (!sub) throw ApiError.notFound('🔍 Subscription not found.');

  const [updated] = await db
    .update(userSubscriptions)
    .set({
      ...(dto.tierId && { tierId: dto.tierId }),
      ...(dto.isSubscribed !== undefined && { isSubscribed: dto.isSubscribed }),
      ...(dto.status && { status: dto.status }),
      ...(dto.expiresAt !== undefined && {
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
      ...(dto.autoRenew !== undefined && { autoRenew: dto.autoRenew }),
      ...(dto.limitLeft !== undefined && { limitLeft: dto.limitLeft }),
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, id))
    .returning();

  return updated;
}

/**
 * Downgrades a user back to the free tier after a full refund.
 * Resets limitLeft to FREE_TIER_LIMIT and marks subscription cancelled.
 */
export async function downgradeToFree(
  userId: string,
  paymentId: string,
  provider: string,
): Promise<void> {
  const freeTierId = await getFreeTierId();

  const [sub] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  if (!sub) return; // nothing to downgrade

  const limitBefore = sub.limitLeft;

  await db
    .update(userSubscriptions)
    .set({
      tierId: freeTierId,
      isSubscribed: false,
      status: 'cancelled',
      limitLeft: FREE_TIER_LIMIT,
      autoRenew: false,
      expiresAt: null,
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.userId, userId));

  // Usage log entry for the downgrade
  await db.insert(subscriptionUsageLog).values({
    userId,
    action: 'reset',
    limitBefore,
    limitAfter: FREE_TIER_LIMIT,
  });

  // Audit log entry
  await db.insert(paymentAuditLog).values({
    userId,
    paymentId,
    provider: provider as 'razorpay' | 'stripe' | 'paypal',
    action: 'subscription_cancelled',
    previousStatus: sub.status,
    newStatus: 'cancelled',
    note: 'Subscription downgraded to free tier due to full refund.',
  });
}
