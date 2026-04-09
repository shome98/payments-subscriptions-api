import { eq, ilike, and, count, desc, inArray } from 'drizzle-orm';
import { db, tiers, type Tier, type NewTier } from '../db';
import { ApiError } from '../utils/api-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type {
  CreateTierDto,
  UpdateTierDto,
  PaginationDto,
  TiersByIdsDto,
} from '../validators/tier.validator';

//  Service

export async function createTier(dto: CreateTierDto): Promise<Tier> {
  const existing = await db
    .select({ id: tiers.id })
    .from(tiers)
    .where(eq(tiers.name, dto.name))
    .limit(1);

  if (existing.length > 0) {
    throw ApiError.conflict(
      `⚠️ A tier with the name "${dto.name}" already exists.`,
    );
  }

  const [tier] = await db
    .insert(tiers)
    .values({
      name: dto.name,
      description: dto.description ?? null,
      benefits: dto.benefits,
      price: String(dto.price),
      limit: dto.limit,
      permission: dto.permission,
      isActive: dto.isActive,
    })
    .returning();

  return tier;
}

export async function getAllTiers(
  query: PaginationDto,
  onlyActive = false,
): Promise<{ tiers: Tier[]; meta: Record<string, unknown> }> {
  const { page, limit, offset } = parsePagination(query);

  const conditions = [];
  if (onlyActive) conditions.push(eq(tiers.isActive, true));
  if (query.search) conditions.push(ilike(tiers.name, `%${query.search}%`));
  if (query.isActive !== undefined)
    conditions.push(eq(tiers.isActive, query.isActive));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(tiers)
    .where(whereClause);

  const rows = await db
    .select()
    .from(tiers)
    .where(whereClause)
    .orderBy(desc(tiers.price))
    .limit(limit)
    .offset(offset);

  return { tiers: rows, meta: buildPaginationMeta(Number(total), page, limit) };
}

export async function getTierById(id: string): Promise<Tier> {
  const [tier] = await db.select().from(tiers).where(eq(tiers.id, id)).limit(1);
  if (!tier) throw ApiError.notFound('🔍 Tier not found.');
  return tier;
}

export async function getTiersByIds(dto: TiersByIdsDto): Promise<Tier[]> {
  const rows = await db
    .select()
    .from(tiers)
    .where(and(inArray(tiers.id, dto.ids), eq(tiers.isActive, true)));
  return rows;
}

export async function updateTier(
  id: string,
  dto: UpdateTierDto,
): Promise<Tier> {
  await getTierById(id); // ensure exists

  if (dto.name) {
    const conflict = await db
      .select({ id: tiers.id })
      .from(tiers)
      .where(and(eq(tiers.name, dto.name)))
      .limit(1);
    if (conflict.length > 0 && conflict[0].id !== id) {
      throw ApiError.conflict(`⚠️ Tier name "${dto.name}" is already taken.`);
    }
  }

  const [updated] = await db
    .update(tiers)
    .set({
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.benefits !== undefined && { benefits: dto.benefits }),
      ...(dto.price !== undefined && { price: String(dto.price) }),
      ...(dto.limit !== undefined && { limit: dto.limit }),
      ...(dto.permission !== undefined && { permission: dto.permission }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      updatedAt: new Date(),
    })
    .where(eq(tiers.id, id))
    .returning();

  return updated;
}

export async function deleteTier(id: string): Promise<void> {
  await getTierById(id);
  await db.delete(tiers).where(eq(tiers.id, id));
}
