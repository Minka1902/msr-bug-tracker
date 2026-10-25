import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';

const PG_UNIQUE_VIOLATION = '23505';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, details: error.details });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Invalid input', details: error.issues.map(({ path, message }) => ({ path, message })) });
    return;
  }
  if (error?.code === PG_UNIQUE_VIOLATION) {
    res.status(409).json({ error: 'Already exists', details: error.constraint });
    return;
  }
  if (error?.type === 'entity.too.large' || error?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }
  logger.error({ err: error, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: 'Something went wrong' });
};
