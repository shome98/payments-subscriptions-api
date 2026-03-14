import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/api-response';

type RequestField = 'body' | 'query' | 'params';

/**
 * Zod validation middleware factory.
 * Validates req[field] against the provided schema.
 * On failure, returns 400 with structured field errors.
 */
export function validate(schema: ZodSchema, field: RequestField = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[field]);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.map(String).join(' → '),
        message: issue.message,
      }));
      sendError(res, '❌ Validation failed.', 400, errors);
      return;
    }

    // Assign parsed (coerced + stripped) value back
    req[field] = result.data;
    next();
  };
}
