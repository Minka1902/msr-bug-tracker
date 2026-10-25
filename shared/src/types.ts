import type {
  AiProvider,
  NavLayout,
  Priority,
  RelationType,
  Reproducibility,
  Severity,
  StatusCategory,
  TaskType,
  ThemeMode,
  ThemeStyle,
  Workflow,
} from './enums';

export interface UserRef {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface UserPreferences {
  style: ThemeStyle;
  mode: ThemeMode;
  nav: NavLayout;
  timezone: string;
  aiProvider: AiProvider | null;
}

export interface CurrentUser extends UserRef {
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  preferences: UserPreferences;
  createdAt: string;
  impersonator: UserRef | null;
}

export interface ProjectStats {
  total: number;
  completed: number;
  active: number;
  overdue: number;
  progress: number;
}

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  liveUrl: string | null;
  repoUrl: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  isDemo: boolean;
  isOwner: boolean;
  roleName: string;
  permissions: number;
  stats: ProjectStats;
  members: UserRef[];
  memberCount: number;
  nextDueDate: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface ProjectStatus {
  id: string;
  workflow: Workflow;
  name: string;
  color: string;
  category: StatusCategory;
  position: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface ProjectRole {
  id: string;
  name: string;
  systemKey: 'owner' | 'admin' | 'member' | 'viewer' | null;
  permissions: number;
  memberCount: number;
}

export interface ProjectMember extends UserRef {
  email: string;
  roleId: string;
  roleName: string;
  isOwner: boolean;
  joinedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  statuses: ProjectStatus[];
  labels: Label[];
  roles: ProjectRole[];
  memberList: ProjectMember[];
}

export interface TaskCard {
  id: string;
  projectId: string;
  projectKey: string;
  number: number;
  identifier: string;
  parentId: string | null;
  parentIdentifier: string | null;
  type: TaskType;
  title: string;
  statusId: string;
  statusCategory: StatusCategory;
  priority: Priority;
  severity: Severity | null;
  assignee: UserRef | null;
  reporterId: string | null;
  labels: Label[];
  startDate: string | null;
  dueDate: string | null;
  isBlocked: boolean;
  position: string;
  commentCount: number;
  attachmentCount: number;
  checklistTotal: number;
  checklistDone: number;
  subtaskTotal: number;
  subtaskDone: number;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TaskDetail extends TaskCard {
  description: string;
  blockedReason: string | null;
  reporter: UserRef | null;
  parent: { id: string; identifier: string; title: string } | null;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  envOs: string;
  envBrowser: string;
  envAppVersion: string;
  foundInVersion: string;
  fixVersion: string;
  reproducibility: Reproducibility | null;
}

export interface ChecklistItem {
  id: string;
  text: string;
  isDone: boolean;
  position: string;
}

export interface Comment {
  id: string;
  parentId: string | null;
  author: UserRef;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
  uploader: UserRef;
  commentId: string | null;
  createdAt: string;
}

export interface TaskRelation {
  id: string;
  type: RelationType;
  direction: 'outgoing' | 'incoming';
  task: { id: string; identifier: string; title: string; statusCategory: StatusCategory; type: TaskType };
}

export interface ActivityEntry {
  id: number;
  action: string;
  field: string | null;
  oldValue: unknown;
  newValue: unknown;
  actor: UserRef | null;
  task: { id: string; identifier: string; title: string } | null;
  project: { key: string; name: string; color: string } | null;
  createdAt: string;
}

export interface BoardColumn {
  statusId: string;
  total: number;
  tasks: TaskCard[];
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
}

export interface InviteSummary {
  id: string;
  email: string | null;
  projectName: string | null;
  roleName: string | null;
  inviterName: string;
  uses: number;
  maxUses: number | null;
  expiresAt: string;
  createdAt: string;
}

export interface CreatedInvite extends InviteSummary {
  url: string;
}

export interface InvitePreview {
  inviterName: string;
  email: string | null;
  project: { key: string; name: string; color: string; icon: string } | null;
  roleName: string | null;
  expiresAt: string;
}
