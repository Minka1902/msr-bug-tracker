import type { Emblem } from './emblem';
import type {
  AiProvider,
  ConnectorScope,
  Hand,
  NavLayout,
  Priority,
  ProjectKind,
  RecurrenceFrequency,
  RelationType,
  Reproducibility,
  Severity,
  StatusCategory,
  TaskType,
  ThemeMode,
  ThemeStyle,
  TouchSize,
  Workflow,
} from './enums';
import type { PlanTier, ProjectModule } from './modules';
import type { Motivation } from './schemas/planner';
import type { NotifyKind } from './telegram';

export interface UserRef {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface UserPreferences {
  style: ThemeStyle;
  mode: ThemeMode;
  nav: NavLayout;
  hand: Hand;
  touch: TouchSize;
  timezone: string;
  aiProvider: AiProvider | null;
  motivation: Motivation;
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
  kind: ProjectKind;
  module: ProjectModule;
  name: string;
  description: string;
  color: string;
  icon: string;
  emblem: Emblem | null;
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
  isAgent: boolean;
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
  recurrence: TaskRecurrence | null;
  escalation: TaskEscalation | null;
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
  project: { key: string; name: string; color: string; icon: string; emblem: Emblem | null } | null;
  roleName: string | null;
  expiresAt: string;
}

export type CalendarSource = 'app' | 'google' | 'icloud';

export interface CalendarItem {
  id: string;
  kind: 'event' | 'task';
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  important: boolean;
  source: CalendarSource;
  calendarName: string;
  color: string;
  project: { key: string; name: string } | null;
  taskIdentifier: string | null;
  description: string;
  location: string;
  attendees: UserRef[];
  editable: boolean;
  connectionId: string | null;
  appointment: boolean;
  reminders: number[];
}

export interface CalendarConflict {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  calendarName: string;
  personName: string;
}

export interface UpcomingConflict {
  item: { kind: 'task' | 'event'; id: string; title: string; date: string; identifier: string | null };
  clashes: CalendarConflict[];
}

export interface ExternalCalendarSettings {
  id: string;
  name: string;
  color: string;
  writable: boolean;
  show: boolean;
  important: boolean;
}

export interface CalendarConnection {
  id: string;
  provider: 'google' | 'icloud';
  accountEmail: string;
  calendars: ExternalCalendarSettings[];
  defaultCalendarId: string | null;
  lastSyncedAt: string | null;
  syncError: string | null;
}

export interface TaskRecurrence {
  freq: RecurrenceFrequency;
  interval: number;
  rotate: string[];
}

export interface EscalationRange {
  from: Priority;
  to: Priority;
}

export interface TaskEscalation extends EscalationRange {
  since: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  isChecked: boolean;
  checkedBy: UserRef | null;
  addedBy: string | null;
  position: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  position: string;
  items: ShoppingItem[];
}

export interface ConnectorRequestPreview {
  clientName: string;
  redirectHost: string;
  scopes: ConnectorScope[];
}

export interface ConnectedApp {
  id: string;
  name: string;
  host: string;
  scopes: ConnectorScope[];
  connectedAt: string;
  lastUsedAt: string;
  worker: { id: string; name: string } | null;
}

export interface AiWorker {
  id: string;
  name: string;
  connection: { id: string; name: string } | null;
  projects: { key: string; name: string; role: string }[];
  createdAt: string;
}

export interface PlanStatus {
  tier: PlanTier;
  startsAt: string | null;
  expiresAt: string | null;
  projectsUsed: number;
  projectsLimit: number;
}

export interface PackBalance {
  module: ProjectModule;
  projectsLeft: number;
}

export interface ShopState {
  plan: PlanStatus;
  packs: PackBalance[];
}

export interface TelegramChat {
  chatId: number;
  title: string;
  isGroup: boolean;
  notify: NotifyKind[];
  onlyMine: boolean;
  defaultListId: string | null;
  mine: boolean;
  canEdit: boolean;
}

export interface TelegramSettings {
  enabled: boolean;
  allowed: boolean;
  requiredPlan: PlanTier;
  botUsername: string | null;
  connected: boolean;
  chats: TelegramChat[];
}
