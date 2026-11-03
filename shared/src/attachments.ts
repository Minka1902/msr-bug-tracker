export const ATTACHMENT_RETENTION_DAYS = 7;

const DAY_MS = 86_400_000;

export const fileDeletesAt = (completedAt: string, createdAt: string) =>
  new Date(
    Math.max(Date.parse(completedAt), Date.parse(createdAt)) + ATTACHMENT_RETENTION_DAYS * DAY_MS,
  ).toISOString();
