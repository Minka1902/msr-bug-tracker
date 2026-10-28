export type When =
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'weekday'; day: number }
  | { kind: 'date'; day: number; month: number };

export type Command =
  | { kind: 'start'; code: string }
  | { kind: 'help' }
  | { kind: 'use'; key: string }
  | { kind: 'add'; items: string[]; list: string | null }
  | { kind: 'bought'; items: string[] }
  | { kind: 'lists' }
  | { kind: 'list'; name: string }
  | { kind: 'open_list'; name: string | null }
  | { kind: 'open_project' }
  | { kind: 'tasks' }
  | { kind: 'mine' }
  | { kind: 'appointments' }
  | { kind: 'task'; identifier: string }
  | { kind: 'done'; identifier: string }
  | { kind: 'assign'; person: string; title: string; when: When | null };

const ITEMS_MAX = 30;
const ITEM_MAX = 120;
const TITLE_MAX = 300;
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const IDENTIFIER = /^([a-z][a-z0-9]{1,5}-\d+)\??$/i;
const DONE = /^(?:done|finished|close)\s+([a-z][a-z0-9]{1,5}-\d+)$/i;
const USE = /^use\s+([a-z][a-z0-9]{1,5})$/i;
const START = /^start(?:\s+(\S+))?$/i;
const ADD_TO_LIST = /^add\s+(.+?)\s+to\s+(?:the\s+|my\s+)?(.+?)(?:\s+shopping)?\s+list$/i;
const ADD = /^add\s+(.+)$/i;
const BOUGHT = /^(?:i\s+)?(?:bought|got)\s+(.+)$/i;
const OPEN_LIST = /^open\s+(?:the\s+)?(.+?)\s+list(?:\s+page)?$/i;
const OPEN_LISTS = /^open\s+(?:the\s+)?(?:shopping\s+)?lists?(?:\s+page)?$/i;
const OPEN_PROJECT = /^open\s+(?:the\s+)?(?:project|board)(?:\s+page)?$/i;
const ASSIGN = /^(.+?)\s+(?:needs?|has|have)\s+to\s+(.+)$/i;
const WHEN =
  /\s+(today|tonight|tomorrow|(?:on\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday)?|on\s+(\d{1,2})[/.](\d{1,2}))$/i;
const MENTION = /@[a-z0-9_]*bot\b/gi;
const SPLIT = /\s*(?:,|&|\band\b)\s*/i;

const KEYWORDS: Record<string, Command> = {
  help: { kind: 'help' },
  '?': { kind: 'lists' },
  'chores?': { kind: 'tasks' },
  chores: { kind: 'tasks' },
  'tasks?': { kind: 'tasks' },
  tasks: { kind: 'tasks' },
  'mine?': { kind: 'mine' },
  mine: { kind: 'mine' },
  'my tasks?': { kind: 'mine' },
  'my tasks': { kind: 'mine' },
  'appointments?': { kind: 'appointments' },
  appointments: { kind: 'appointments' },
};

const itemsOf = (text: string) =>
  text
    .split(SPLIT)
    .map((item) => item.trim().slice(0, ITEM_MAX))
    .filter(Boolean)
    .slice(0, ITEMS_MAX);

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const whenOf = (match: RegExpMatchArray): When => {
  const word = match[1]!.toLowerCase();
  if (word === 'today' || word === 'tonight') return { kind: 'today' };
  if (word === 'tomorrow') return { kind: 'tomorrow' };
  if (match[3]) return { kind: 'date', day: Number(match[3]), month: Number(match[4]) };
  return { kind: 'weekday', day: WEEKDAYS.indexOf(match[2]!.toLowerCase().slice(0, 3)) };
};

const assignOf = (person: string, rest: string): Command => {
  const when = rest.match(WHEN);
  const title = (when ? rest.slice(0, when.index) : rest).trim().slice(0, TITLE_MAX);
  return {
    kind: 'assign',
    person: person.trim(),
    title: capitalize(title),
    when: when ? whenOf(when) : null,
  };
};

export const parseCommand = (raw: string): Command => {
  const text = raw.replace(MENTION, '').replace(/^\//, '').replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const keyword = KEYWORDS[lower];
  if (keyword) return keyword;
  let match: RegExpMatchArray | null;
  if ((match = text.match(START))) return match[1] ? { kind: 'start', code: match[1] } : { kind: 'help' };
  if ((match = text.match(USE))) return { kind: 'use', key: match[1]!.toUpperCase() };
  if ((match = text.match(IDENTIFIER))) return { kind: 'task', identifier: match[1]!.toUpperCase() };
  if ((match = text.match(DONE))) return { kind: 'done', identifier: match[1]!.toUpperCase() };
  if (OPEN_PROJECT.test(text)) return { kind: 'open_project' };
  if (OPEN_LISTS.test(text)) return { kind: 'open_list', name: null };
  if ((match = text.match(OPEN_LIST))) return { kind: 'open_list', name: match[1]!.trim() };
  if ((match = text.match(ADD_TO_LIST)))
    return { kind: 'add', items: itemsOf(match[1]!), list: match[2]!.trim() };
  if ((match = text.match(ADD))) return { kind: 'add', items: itemsOf(match[1]!), list: null };
  if ((match = text.match(BOUGHT))) return { kind: 'bought', items: itemsOf(match[1]!) };
  if ((match = text.match(ASSIGN))) return assignOf(match[1]!, match[2]!);
  if (text.endsWith('?') && text.length > 1) return { kind: 'list', name: text.slice(0, -1).trim() };
  return { kind: 'add', items: itemsOf(text), list: null };
};
