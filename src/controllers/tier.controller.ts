import { Request, Response, NextFunction } from 'express';
import * as service from '../services/tier.service';
import { sendSuccess } from '../utils/api-response';
import type {
  CreateTierDto,
  UpdateTierDto,
  PaginationDto,
  TiersByIdsDto,
} from '../validators/tier.validator';

//  Public

/** GET /tiers — list active tiers (public) */
export async function getActiveTiers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tiers, meta } = await service.getAllTiers(
      req.query as unknown as PaginationDto,
      true,
    );
    sendSuccess(
      res,
      `✅ Retrieved ${tiers.length} active tier(s).`,
      tiers,
      200,
      meta,
    );
  } catch (err) {
    next(err);
  }
}

/** GET /tiers/:id — single tier (public) */
export async function getTierById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tier = await service.getTierById(req.params.id as string);
    sendSuccess(res, '✅ Tier retrieved.', tier);
  } catch (err) {
    next(err);
  }
}

/** POST /tiers/by-ids — batch fetch tiers by IDs (public, for client display) */
export async function getTiersByIds(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tiers = await service.getTiersByIds(req.body as TiersByIdsDto);
    sendSuccess(res, `✅ Retrieved ${tiers.length} tier(s).`, tiers);
  } catch (err) {
    next(err);
  }
}

//  Admin

/** GET /admin/tiers — list all tiers with pagination */
export async function adminGetAllTiers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tiers, meta } = await service.getAllTiers(
      req.query as unknown as PaginationDto,
    );
    sendSuccess(res, `✅ Retrieved ${tiers.length} tier(s).`, tiers, 200, meta);
  } catch (err) {
    next(err);
  }
}

/** POST /admin/tiers — create tier */
export async function createTier(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tier = await service.createTier(req.body as CreateTierDto);
    sendSuccess(res, '🎉 Tier created successfully.', tier, 201);
  } catch (err) {
    next(err);
  }
}

/** PATCH /admin/tiers/:id — update tier */
export async function updateTier(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tier = await service.updateTier(
      req.params.id as string,
      req.body as UpdateTierDto,
    );
    sendSuccess(res, '✅ Tier updated successfully.', tier);
  } catch (err) {
    next(err);
  }
}

/** DELETE /admin/tiers/:id — delete tier */
export async function deleteTier(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await service.deleteTier(req.params.id as string);
    sendSuccess(res, '🗑️ Tier deleted successfully.');
  } catch (err) {
    next(err);
  }
}
