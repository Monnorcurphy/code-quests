import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  process.stderr.write(`[server] unhandled error: ${err.stack ?? err.message}\n`);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
}
