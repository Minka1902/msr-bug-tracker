import type { SessionUser } from '../middleware/session';

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
    }
  }
}

export {};
