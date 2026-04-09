import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/api-response';

type RequestField = 'body' | 'query' | 'params';

// Extend Express Request to include validated data
declare global {
  namespace Express {
    interface Request {
      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}

/**
 * Zod validation middleware factory.
 * Validates req[field] against the provided schema.
 * On success, attaches parsed data to req.validated* properties.
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

    // Attach validated data to separate properties to avoid read-only issues
    // req.query is read-only on IncomingMessage
    switch (field) {
      case 'query':
        req.validatedQuery = result.data;
        break;
      case 'body':
        req.body = result.data;
        break;
      case 'params':
        req.validatedParams = result.data;
        break;
    }
    next();
  };
}
