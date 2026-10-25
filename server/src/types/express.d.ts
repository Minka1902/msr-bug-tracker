import type { SessionUser } from '../middleware/session';
import type { ProjectContext } from '../modules/projects/access';
import type { TaskContext } from '../modules/tasks/access';

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
      project?: ProjectContext;
      task?: TaskContext;
    }
  }
}

export {};
