import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

type Source = 'body' | 'query' | 'params';

export function validate<T>(schema: ZodSchema<T>, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      (req as Request & Record<Source, unknown>)[source] = parsed as unknown as Request[Source];
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fields = err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        }));
        const first = fields[0];
        const headline = first
          ? `${first.path || 'request'}: ${first.message}`
          : 'Invalid request body';
        return next(
          ApiError.badRequest(`Validation failed — ${headline}`, {
            fields,
            flatten: err.flatten(),
          })
        );
      }
      next(err);
    }
  };
}
