import { Request, Response, NextFunction } from 'express';
import * as service from '../services/discount.service';
import { sendSuccess } from '../utils/api-response';
import type {
  CreateDiscountDto,
  UpdateDiscountDto,
  ValidateDiscountQueryDto,
} from '../validators/discount.validator';

//  Public

/** GET /discounts/validate?code=X&tierId=Y */
export async function validateDiscount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.validateDiscount(
      req.query as unknown as ValidateDiscountQueryDto,
    );
    sendSuccess(res, '🎉 Discount code is valid!', result);
  } catch (err) {
    next(err);
  }
}

//  Admin

/** GET /admin/discounts */
export async function getAllDiscounts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { discounts, meta } = await service.getAllDiscounts(
      req.query as { page?: number; limit?: number },
    );
    sendSuccess(
      res,
      `✅ Retrieved ${discounts.length} discount(s).`,
      discounts,
      200,
      meta,
    );
  } catch (err) {
    next(err);
  }
}

/** GET /admin/discounts/:id */
export async function getDiscountById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const discount = await service.getDiscountById(req.params.id as string);
    sendSuccess(res, '✅ Discount retrieved.', discount);
  } catch (err) {
    next(err);
  }
}

/** POST /admin/discounts */
export async function createDiscount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const discount = await service.createDiscount(
      req.body as CreateDiscountDto,
    );
    sendSuccess(res, '🎉 Discount created successfully.', discount, 201);
  } catch (err) {
    next(err);
  }
}

/** PATCH /admin/discounts/:id */
export async function updateDiscount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const discount = await service.updateDiscount(
      req.params.id as string,
      req.body as UpdateDiscountDto,
    );
    sendSuccess(res, '✅ Discount updated successfully.', discount);
  } catch (err) {
    next(err);
  }
}

/** DELETE /admin/discounts/:id */
export async function deleteDiscount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await service.deleteDiscount(req.params.id as string);
    sendSuccess(res, '🗑️ Discount deleted successfully.');
  } catch (err) {
    next(err);
  }
}
