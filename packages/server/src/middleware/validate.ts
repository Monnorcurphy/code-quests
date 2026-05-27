import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.errors[0];
      const field = firstError.path.length > 0 ? String(firstError.path.join('.')) : undefined;
      res.status(400).json({ error: firstError.message, field });
      return;
    }
    req.body = result.data;
    next();
  };
}
