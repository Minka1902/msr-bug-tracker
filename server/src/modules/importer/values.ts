import type { Priority, Severity, StatusCategory, TaskType } from '@msr/shared/enums';
import type { SourcePerson } from './types';

const PRIORITY_WORDS: [RegExp, Priority][] = [
  [/^(urgent|highest|critical|blocker|p0|1)$/, 'urgent'],
  [/^(high|major|p1|2)$/, 'high'],
  [/^(medium|normal|moderate|p2|3)$/, 'medium'],
  [/^(low|lowest|minor|trivial|p3|p4|4|5)$/, 'low'],
];
const SEVERITY_WORDS: [RegExp, Severity][] = [
  [/^(critical|blocker|s1)$/, 'critical'],
  [/^(major|high|s2)$/, 'major'],
  [/^(minor|medium|normal|s3)$/, 'minor'],
  [/^(trivial|low|s4)$/, 'trivial'],
];
const TYPE_WORDS: [RegExp, TaskType][] = [
  [/bug|defect|incident|error/, 'bug'],
  [/feature|story|epic/, 'feature'],
  [/improvement|enhancement|refactor/, 'improvement'],
];
const CATEGORY_WORDS: [RegExp, StatusCategory][] = [
  [/done|closed|complete|resolved|shipped|released|fixed|cancel|won.?t|archived/, 'done'],
  [/progress|doing|review|testing|qa|active|started|development|blocked|verify/, 'in_progress'],
  [/backlog|icebox|someday|triage|idea/, 'backlog'],
];
const ISO_DATE = /^(\d{4}-\d{2}-\d{2})/;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const MS_EPOCH_MIN = 100_000_000_000;

const clean = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');

export const parsePriority = (value: string | null | undefined): Priority => {
  const word = clean(value ?? '');
  return PRIORITY_WORDS.find(([pattern]) => pattern.test(word))?.[1] ?? 'medium';
};

export const parseSeverity = (value: string | null | undefined): Severity | null => {
  const word = clean(value ?? '');
  return SEVERITY_WORDS.find(([pattern]) => pattern.test(word))?.[1] ?? null;
};

export const parseType = (value: string | null | undefined): TaskType => {
  const word = clean(value ?? '');
  return TYPE_WORDS.find(([pattern]) => pattern.test(word))?.[1] ?? 'task';
};

export const categoryFromName = (name: string | null | undefined): StatusCategory | null => {
  const word = clean(name ?? '');
  if (!word) return null;
  return CATEGORY_WORDS.find(([pattern]) => pattern.test(word))?.[1] ?? 'todo';
};

export const toIsoDate = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const text = String(value).trim();
  const iso = ISO_DATE.exec(text);
  if (iso) return iso[1]!;
  const number = Number(text);
  if (Number.isFinite(number) && number > MS_EPOCH_MIN) return new Date(number).toISOString().slice(0, 10);
  const parsed = Date.parse(text.replace(/(\d)(st|nd|rd|th)\b/g, '$1'));
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
};

export const toIsoTimestamp = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  const date =
    value instanceof Date
      ? value
      : Number.isFinite(number) && number > MS_EPOCH_MIN
        ? new Date(number)
        : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const parsePerson = (value: string | null | undefined): SourcePerson | null => {
  const first =
    (value ?? '')
      .split(/[,;\n]/)[0]
      ?.trim()
      .replace(/^\[|\]$/g, '') ?? '';
  if (!first) return null;
  const email = EMAIL.exec(first)?.[0]?.toLowerCase() ?? null;
  const name =
    first
      .replace(EMAIL, '')
      .replace(/[<>()"]/g, '')
      .trim() || null;
  return { email, name };
};

export const parseList = (value: string | null | undefined) =>
  [
    ...new Set(
      (value ?? '')
        .split(/[,;\n]/)
        .map((item) =>
          item
            .trim()
            .replace(/^\[|\]$/g, '')
            .trim(),
        )
        .filter(Boolean),
    ),
  ].slice(0, 30);

export const personKey = (person: SourcePerson) =>
  person.email ? person.email.toLowerCase() : `name:${(person.name ?? '').toLowerCase()}`;
