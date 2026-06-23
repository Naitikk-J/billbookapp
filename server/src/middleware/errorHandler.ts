import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { isProd } from '../config/env';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound('Route not found'));
}

export function errorHandler(
  err: Error & { status?: number; details?: unknown; code?: number | string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { message: err.message, details: err.details ?? null },
    });
    return;
  }

  if (err.name === 'CastError') {
    res.status(400).json({ error: { message: 'Invalid identifier' } });
    return;
  }

  if (err.name === 'ValidationError') {
    res.status(400).json({ error: { message: err.message } });
    return;
  }

  if (err.code === 11000) {
    res.status(409).json({ error: { message: 'Duplicate key' } });
    return;
  }

  if (!isProd) {
    console.error('[error]', err);
  }

  res.status(500).json({
    error: {
      message: isProd ? 'Internal server error' : err.message || 'Internal server error',
    },
  });
}
