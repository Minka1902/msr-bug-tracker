import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';

const PG_UNIQUE_VIOLATION = '23505';
const UNIQUE_MESSAGES: Record<string, string> = {
  projects_key_key: 'That project key is already taken',
  project_statuses_name_idx: 'A status with this name already exists in this workflow',
  labels_name_idx: 'A label with this name already exists',
  project_roles_name_idx: 'A role with this name already exists',
  project_members_pkey: 'That person is already a member',
  users_email_key: 'An account with this email already exists',
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, details: error.details });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Invalid input',
      details: error.issues.map(({ path, message }) => ({ path, message })),
    });
    return;
  }
  if (error?.code === PG_UNIQUE_VIOLATION) {
    res.status(409).json({ error: UNIQUE_MESSAGES[error.constraint] ?? 'Already exists' });
    return;
  }
  if (error?.type === 'entity.too.large' || error?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }
  logger.error({ err: error, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: 'Something went wrong' });
};
