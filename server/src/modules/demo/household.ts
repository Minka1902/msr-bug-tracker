import { randomUUID } from 'node:crypto';
import { generateNKeysBetween } from 'fractional-indexing';
import {
  HOUSEHOLD_LABELS,
  HOUSEHOLD_STATUSES,
  LABEL_COLORS,
  WORKFLOWS,
  type TaskType,
} from '@msr/shared/enums';
import {
  HOUSEHOLD_ROLE_LABELS,
  HOUSEHOLD_ROLE_PERMISSIONS,
  SYSTEM_ROLES,
  type SystemRole,
} from '@msr/shared/permissions';
import type { TaskRecurrence } from '@msr/shared/types';
import { bulkInsert } from '../../db/bulkInsert';
import type { Db } from '../../db/pool';
import { availableKeys } from './generator';

interface DemoChore {
  title: string;
  type: TaskType;
  who: string | null;
  due: number | null;
  done?: boolean;
  label?: string;
  recurrence?: Omit<TaskRecurrence, 'rotate'> & { rotate?: string[] };
}

const DAY = 86_400_000;
const FAMILY: { key: string; name: string; role: SystemRole }[] = [
  { key: 'sam', name: 'Sam Rivera', role: 'admin' },
  { key: 'maya', name: 'Maya Rivera', role: 'member' },
  { key: 'leo', name: 'Leo Rivera', role: 'member' },
  { key: 'nana', name: 'Nana Rivera', role: 'viewer' },
];
const CHORES: DemoChore[] = [
  {
    title: 'Empty the dishwasher',
    type: 'chore',
    who: 'maya',
    due: 0,
    label: 'Kitchen',
    recurrence: { freq: 'daily', interval: 1, rotate: ['maya', 'leo'] },
  },
  {
    title: 'Feed the cat',
    type: 'chore',
    who: 'leo',
    due: 0,
    label: 'Pets',
    recurrence: { freq: 'daily', interval: 1 },
  },
  {
    title: 'Take out the recycling',
    type: 'chore',
    who: 'leo',
    due: 2,
    label: 'Outdoor',
    recurrence: { freq: 'weekly', interval: 1 },
  },
  { title: 'Fold the laundry', type: 'chore', who: 'maya', due: -1, label: 'Laundry' },
  {
    title: 'Vacuum the living room',
    type: 'chore',
    who: 'sam',
    due: 3,
    recurrence: { freq: 'weekly', interval: 1, rotate: ['sam', 'maya', 'leo'] },
  },
  {
    title: 'Water the plants',
    type: 'chore',
    who: 'maya',
    due: 1,
    label: 'Outdoor',
    recurrence: { freq: 'weekly', interval: 1 },
  },
  { title: 'Tidy your bedroom', type: 'chore', who: 'leo', due: -2, done: true },
  {
    title: 'Pack school bags',
    type: 'chore',
    who: 'maya',
    due: 1,
    label: 'School',
    recurrence: { freq: 'daily', interval: 1, rotate: ['maya', 'leo'] },
  },
  { title: "Buy a present for Nana's birthday", type: 'errand', who: 'owner', due: 3 },
  { title: 'Pick up the dry cleaning', type: 'errand', who: 'sam', due: 1 },
  { title: 'Return library books', type: 'errand', who: null, due: 5, label: 'School' },
  { title: 'Renew the car insurance', type: 'task', who: 'owner', due: 10 },
  { title: 'Book dentist check-ups', type: 'task', who: 'sam', due: 7, done: true },
];
const GROCERIES: [string, string, boolean][] = [
  ['Milk', '2 L', false],
  ['Eggs', '12', false],
  ['Bananas', '', false],
  ['Bread', '', false],
  ['Coffee beans', '500 g', false],
  ['Butter', '', true],
];

const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);

export const generateDemoHousehold = async (db: Db, ownerId: string, tag: string, now: number) => {
  const [key] = await availableKeys(db, [{ key: 'HOME' }]);
  const projectId = randomUUID();
  const people: Record<string, string> = { owner: ownerId };
  FAMILY.forEach((person) => (people[person.key] = randomUUID()));

  await bulkInsert(
    db,
    'users',
    [
      { name: 'id', type: 'uuid' },
      { name: 'name', type: 'text' },
      { name: 'email', type: 'text', cast: 'citext' },
      { name: 'demo_owner_id', type: 'uuid' },
      { name: 'email_verified_at', type: 'timestamptz' },
    ],
    FAMILY.map((person) => ({
      id: people[person.key],
      name: person.name,
      email: `${person.key}.rivera.${tag}@demo.msr.local`,
      demo_owner_id: ownerId,
      email_verified_at: new Date(now),
    })),
  );
  await db.query(
    `INSERT INTO projects (id, key, kind, name, description, color, icon, owner_id, task_seq, is_demo)
     VALUES ($1, $2, 'household', 'The Rivera family', 'Chores, errands and shopping for a demo family.', '#f59e0b', 'house', $3, $4, true)`,
    [projectId, key, ownerId, CHORES.length],
  );

  const roleIds = Object.fromEntries(SYSTEM_ROLES.map((role) => [role, randomUUID()])) as Record<
    SystemRole,
    string
  >;
  await bulkInsert(
    db,
    'project_roles',
    [
      { name: 'id', type: 'uuid' },
      { name: 'project_id', type: 'uuid' },
      { name: 'name', type: 'text' },
      { name: 'system_key', type: 'text', cast: 'system_role' },
      { name: 'permissions', type: 'int' },
      { name: 'position', type: 'int' },
    ],
    SYSTEM_ROLES.map((role, position) => ({
      id: roleIds[role],
      project_id: projectId,
      name: HOUSEHOLD_ROLE_LABELS[role],
      system_key: role,
      permissions: HOUSEHOLD_ROLE_PERMISSIONS[role],
      position,
    })),
  );
  await bulkInsert(
    db,
    'project_members',
    [
      { name: 'project_id', type: 'uuid' },
      { name: 'user_id', type: 'uuid' },
      { name: 'role_id', type: 'uuid' },
    ],
    [
      { project_id: projectId, user_id: ownerId, role_id: roleIds.owner },
      ...FAMILY.map((person) => ({
        project_id: projectId,
        user_id: people[person.key],
        role_id: roleIds[person.role],
      })),
    ],
  );

  const statuses = WORKFLOWS.flatMap((workflow) => {
    const positions = generateNKeysBetween(null, null, HOUSEHOLD_STATUSES[workflow].length);
    return HOUSEHOLD_STATUSES[workflow].map((status, index) => ({
      id: randomUUID(),
      project_id: projectId,
      workflow,
      ...status,
      position: positions[index],
    }));
  });
  await bulkInsert(
    db,
    'project_statuses',
    [
      { name: 'id', type: 'uuid' },
      { name: 'project_id', type: 'uuid' },
      { name: 'workflow', type: 'text', cast: 'workflow' },
      { name: 'name', type: 'text' },
      { name: 'color', type: 'text' },
      { name: 'category', type: 'text', cast: 'status_category' },
      { name: 'position', type: 'text' },
    ],
    statuses,
  );
  const statusOf = (category: string) =>
    statuses.find((status) => status.workflow === 'task' && status.category === category)!.id;

  const labels = HOUSEHOLD_LABELS.map((name, index) => ({
    id: randomUUID(),
    project_id: projectId,
    name,
    color: LABEL_COLORS[index % LABEL_COLORS.length],
  }));
  await bulkInsert(
    db,
    'labels',
    [
      { name: 'id', type: 'uuid' },
      { name: 'project_id', type: 'uuid' },
      { name: 'name', type: 'text' },
      { name: 'color', type: 'text' },
    ],
    labels,
  );

  const open = CHORES.filter((chore) => !chore.done);
  const openPositions = generateNKeysBetween(null, null, open.length);
  const donePositions = generateNKeysBetween(null, null, CHORES.length - open.length);
  const tasks = CHORES.map((chore, index) => ({
    id: randomUUID(),
    project_id: projectId,
    number: index + 1,
    type: chore.type,
    title: chore.title,
    status_id: statusOf(chore.done ? 'done' : 'todo'),
    assignee_id: chore.who ? people[chore.who] : null,
    reporter_id: ownerId,
    due_date: chore.due === null ? null : isoDate(now + chore.due * DAY),
    completed_at: chore.done ? new Date(now - DAY) : null,
    recurrence: chore.recurrence
      ? JSON.stringify({
          ...chore.recurrence,
          rotate: (chore.recurrence.rotate ?? []).map((who) => people[who]),
        })
      : null,
    position: chore.done ? donePositions.shift() : openPositions.shift(),
  }));
  await bulkInsert(
    db,
    'tasks',
    [
      { name: 'id', type: 'uuid' },
      { name: 'project_id', type: 'uuid' },
      { name: 'number', type: 'int' },
      { name: 'type', type: 'text', cast: 'task_type' },
      { name: 'title', type: 'text' },
      { name: 'status_id', type: 'uuid' },
      { name: 'assignee_id', type: 'uuid' },
      { name: 'reporter_id', type: 'uuid' },
      { name: 'due_date', type: 'date' },
      { name: 'completed_at', type: 'timestamptz' },
      { name: 'recurrence', type: 'text', cast: 'jsonb' },
      { name: 'position', type: 'text' },
    ],
    tasks,
  );
  await bulkInsert(
    db,
    'task_labels',
    [
      { name: 'task_id', type: 'uuid' },
      { name: 'label_id', type: 'uuid' },
    ],
    CHORES.flatMap((chore, index) =>
      chore.label
        ? [{ task_id: tasks[index]!.id, label_id: labels.find((label) => label.name === chore.label)!.id }]
        : [],
    ),
  );

  const lists = [
    { id: randomUUID(), project_id: projectId, name: 'Groceries', position: 'a0' },
    { id: randomUUID(), project_id: projectId, name: 'Hardware store', position: 'a1' },
  ];
  await bulkInsert(
    db,
    'shopping_lists',
    [
      { name: 'id', type: 'uuid' },
      { name: 'project_id', type: 'uuid' },
      { name: 'name', type: 'text' },
      { name: 'position', type: 'text' },
    ],
    lists,
  );
  const itemPositions = generateNKeysBetween(null, null, GROCERIES.length + 1);
  await bulkInsert(
    db,
    'shopping_items',
    [
      { name: 'list_id', type: 'uuid' },
      { name: 'name', type: 'text' },
      { name: 'quantity', type: 'text' },
      { name: 'is_checked', type: 'bool' },
      { name: 'checked_by', type: 'uuid' },
      { name: 'checked_at', type: 'timestamptz' },
      { name: 'added_by', type: 'uuid' },
      { name: 'position', type: 'text' },
    ],
    [
      ...GROCERIES.map(([name, quantity, checked], index) => ({
        list_id: lists[0]!.id,
        name,
        quantity,
        is_checked: checked,
        checked_by: checked ? people.sam : null,
        checked_at: checked ? new Date(now) : null,
        added_by: index % 2 ? people.maya : ownerId,
        position: itemPositions[index],
      })),
      {
        list_id: lists[1]!.id,
        name: 'Light bulbs (E27)',
        quantity: '4',
        is_checked: false,
        added_by: people.sam,
        position: itemPositions.at(-1),
      },
    ],
  );

  const swimming = Date.parse(`${isoDate(now + DAY)}T15:00:00Z`);
  await bulkInsert(
    db,
    'calendar_events',
    [
      { name: 'project_id', type: 'uuid' },
      { name: 'created_by', type: 'uuid' },
      { name: 'title', type: 'text' },
      { name: 'location', type: 'text' },
      { name: 'starts_at', type: 'timestamptz' },
      { name: 'ends_at', type: 'timestamptz' },
      { name: 'all_day', type: 'bool' },
      { name: 'is_important', type: 'bool' },
    ],
    [
      {
        project_id: projectId,
        created_by: ownerId,
        title: "Nana's 80th birthday",
        location: "Nana's house",
        starts_at: `${isoDate(now + 3 * DAY)}T00:00:00Z`,
        ends_at: `${isoDate(now + 4 * DAY)}T00:00:00Z`,
        all_day: true,
        is_important: true,
      },
      {
        project_id: projectId,
        created_by: ownerId,
        title: 'Swimming lesson',
        location: 'City pool',
        starts_at: new Date(swimming),
        ends_at: new Date(swimming + 3_600_000),
        all_day: false,
        is_important: false,
      },
    ],
  );
  return { taskCount: tasks.length };
};
