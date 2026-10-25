import type { SessionUser } from '../middleware/session';
import type { ProjectContext } from '../modules/projects/access';

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
      project?: ProjectContext;
    }
  }
}

export {};
