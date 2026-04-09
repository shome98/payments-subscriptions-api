import { eq, and, count, desc, lte } from 'drizzle-orm';
import { db, discounts, tiers, type Discount, type NewDiscount } from '../db';
import { ApiError } from '../utils/api-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type {
  CreateDiscountDto,
  UpdateDiscountDto,
  ValidateDiscountQueryDto,
} from '../validators/discount.validator';

//  Types

export interface ValidatedDiscount {
  discount: Discount;
  finalPrice: string;
  originalPrice: string;
}

//  Service

export async function createDiscount(
  dto: CreateDiscountDto,
): Promise<Discount> {
  // Ensure tier exists
  const [tier] = await db
    .select({ id: tiers.id, price: tiers.price })
    .from(tiers)
    .where(eq(tiers.id, dto.tierId))
    .limit(1);

  if (!tier) throw ApiError.notFound('🔍 Tier not found.');

  // Compute final price
  const originalPrice = Number(tier.price);
  const finalPrice = Number(
    (originalPrice * (1 - dto.discountPercentage / 100)).toFixed(2),
  );

  const [discount] = await db
    .insert(discounts)
    .values({
      tierId: dto.tierId,
      code: dto.code.toUpperCase(),
      discountPercentage: String(dto.discountPercentage),
      finalPrice: String(finalPrice),
      validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      maxUses: dto.maxUses,
      isActive: dto.isActive,
    })
    .returning();

  return discount;
}

export async function validateDiscount(
  dto: ValidateDiscountQueryDto,
): Promise<ValidatedDiscount> {
  const now = new Date();

  const [discount] = await db
    .select()
    .from(discounts)
    .where(
      and(
        eq(discounts.code, dto.code.toUpperCase()),
        eq(discounts.tierId, dto.tierId),
        eq(discounts.isActive, true),
        lte(discounts.validFrom, now),
      ),
    )
    .limit(1);

  if (!discount) {
    throw ApiError.notFound(
      '🔍 Discount code not found or not applicable for this tier.',
    );
  }

  if (discount.validUntil && new Date(discount.validUntil) < now) {
    throw ApiError.badRequest('⏰ Discount code has expired.');
  }

  if (discount.maxUses > 0 && discount.usedCount >= discount.maxUses) {
    throw ApiError.badRequest(
      '🚫 Discount code has reached its maximum usage limit.',
    );
  }

  const [tier] = await db
    .select({ price: tiers.price })
    .from(tiers)
    .where(eq(tiers.id, dto.tierId))
    .limit(1);

  return {
    discount,
    finalPrice: discount.finalPrice,
    originalPrice: tier?.price ?? '0',
  };
}

export async function getDiscountById(id: string): Promise<Discount> {
  const [discount] = await db
    .select()
    .from(discounts)
    .where(eq(discounts.id, id))
    .limit(1);

  if (!discount) throw ApiError.notFound('🔍 Discount not found.');
  return discount;
}

export async function getAllDiscounts(query: {
  page?: number;
  limit?: number;
}): Promise<{ discounts: Discount[]; meta: Record<string, unknown> }> {
  const { page, limit, offset } = parsePagination(query);

  const [{ total }] = await db.select({ total: count() }).from(discounts);

  const rows = await db
    .select()
    .from(discounts)
    .orderBy(desc(discounts.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    discounts: rows,
    meta: buildPaginationMeta(Number(total), page, limit),
  };
}

export async function updateDiscount(
  id: string,
  dto: UpdateDiscountDto,
): Promise<Discount> {
  await getDiscountById(id);

  const [updated] = await db
    .update(discounts)
    .set({
      ...(dto.discountPercentage !== undefined && {
        discountPercentage: String(dto.discountPercentage),
      }),
      ...(dto.validFrom !== undefined && {
        validFrom: new Date(dto.validFrom),
      }),
      ...(dto.validUntil !== undefined && {
        validUntil: new Date(dto.validUntil),
      }),
      ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      updatedAt: new Date(),
    })
    .where(eq(discounts.id, id))
    .returning();

  return updated;
}

export async function deleteDiscount(id: string): Promise<void> {
  await getDiscountById(id);
  await db.delete(discounts).where(eq(discounts.id, id));
}

/** Increments used_count after a payment is processed successfully */
export async function incrementDiscountUsage(
  discountId: string,
): Promise<void> {
  const [current] = await db
    .select({ usedCount: discounts.usedCount })
    .from(discounts)
    .where(eq(discounts.id, discountId))
    .limit(1);

  if (!current) return;

  await db
    .update(discounts)
    .set({ usedCount: current.usedCount + 1, updatedAt: new Date() })
    .where(eq(discounts.id, discountId));
}

/** Decrements used_count on a full refund (clamped to 0) */
export async function rollbackDiscountUsage(discountId: string): Promise<void> {
  const [current] = await db
    .select({ usedCount: discounts.usedCount })
    .from(discounts)
    .where(eq(discounts.id, discountId))
    .limit(1);

  if (!current) return;

  const newCount = Math.max(0, current.usedCount - 1);
  await db
    .update(discounts)
    .set({ usedCount: newCount, updatedAt: new Date() })
    .where(eq(discounts.id, discountId));
}
