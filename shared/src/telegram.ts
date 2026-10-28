export const NOTIFY_KINDS = [
  'task_created',
  'task_assigned',
  'status_changed',
  'comments',
  'daily_digest',
  'overdue',
  'priority_raised',
  'appointment_reminders',
  'shopping_changes',
  'new_events',
] as const;

export type NotifyKind = (typeof NOTIFY_KINDS)[number];

export const HOUSEHOLD_ONLY_KINDS: readonly NotifyKind[] = ['appointment_reminders', 'shopping_changes'];

export const NOTIFY_META: Record<NotifyKind, { label: string; description: string }> = {
  task_created: { label: 'New tasks', description: 'Someone adds a task' },
  task_assigned: { label: 'Assignments', description: 'A task is assigned to someone' },
  status_changed: { label: 'Status changes', description: 'A task moves to another status or is done' },
  comments: { label: 'Comments', description: 'Someone comments on a task' },
  daily_digest: {
    label: 'Daily digest',
    description: 'Every morning at 08:00: what is due today and overdue',
  },
  overdue: { label: 'Overdue', description: 'A task passes its due date' },
  priority_raised: { label: 'Priority raised', description: "A task's priority goes up" },
  appointment_reminders: { label: 'Appointment reminders', description: 'Before each appointment' },
  shopping_changes: { label: 'Shopping lists', description: 'Items added in the app, or a list cleared' },
  new_events: { label: 'New events', description: 'Someone adds an event or appointment' },
};

export const kindsFor = (household: boolean) =>
  NOTIFY_KINDS.filter((kind) => household || !HOUSEHOLD_ONLY_KINDS.includes(kind));
