import type { Priority, Severity, StatusCategory, TaskType } from '@msr/shared/enums';

export interface SourcePerson {
  email: string | null;
  name: string | null;
}

export interface NormalizedComment {
  author: SourcePerson;
  body: string;
  createdAt: string | null;
}

export interface NormalizedTask {
  externalId: string | null;
  parentExternalId: string | null;
  title: string;
  description: string;
  type: TaskType;
  status: string | null;
  statusCategory: StatusCategory | null;
  priority: Priority;
  severity: Severity | null;
  assignee: SourcePerson | null;
  labels: string[];
  startDate: string | null;
  dueDate: string | null;
  createdAt: string | null;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  checklist: { text: string; done: boolean }[];
  comments: NormalizedComment[];
}

export interface RowIssue {
  row: number;
  message: string;
}

export const emptyTask = (title: string): NormalizedTask => ({
  externalId: null,
  parentExternalId: null,
  title,
  description: '',
  type: 'task',
  status: null,
  statusCategory: null,
  priority: 'medium',
  severity: null,
  assignee: null,
  labels: [],
  startDate: null,
  dueDate: null,
  createdAt: null,
  stepsToReproduce: '',
  expectedBehavior: '',
  actualBehavior: '',
  checklist: [],
  comments: [],
});
