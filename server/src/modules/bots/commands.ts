import { parseSharedLink } from '@msr/shared/sharedLink';
import type { BotLanguage } from './language';

export type When =
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'days'; days: number }
  | { kind: 'weekday'; day: number }
  | { kind: 'date'; day: number; month: number };

export type Command =
  | { kind: 'start'; code: string }
  | { kind: 'help' }
  | { kind: 'use'; key: string }
  | { kind: 'add'; items: string[]; list: string | null }
  | { kind: 'add_link'; name: string; url: string; list: string | null }
  | { kind: 'bought'; items: string[] }
  | { kind: 'lists' }
  | { kind: 'list'; name: string }
  | { kind: 'open_list'; name: string | null }
  | { kind: 'open_project' }
  | { kind: 'tasks' }
  | { kind: 'mine' }
  | { kind: 'appointments' }
  | { kind: 'task'; identifier: string }
  | { kind: 'done'; identifier: string; decision: string | null }
  | { kind: 'assign'; person: string; title: string; when: When | null };

interface Grammar {
  keywords: Record<string, Command>;
  done: RegExp;
  use: RegExp;
  openProject: RegExp;
  openLists: RegExp;
  openList: RegExp;
  addToList: RegExp;
  add: RegExp;
  bought: RegExp;
  assign: RegExp;
  when: RegExp;
  whenOf: (match: RegExpMatchArray) => When;
  split: (text: string) => string[];
}

const ITEMS_MAX = 30;
const ITEM_MAX = 120;
const TITLE_MAX = 300;
const KEY = '([a-z][a-z0-9]{1,5})';
const TASK_ID = '([a-z][a-z0-9]{1,5}-\\d+)';
const DONE_TAIL = `\\s+${TASK_ID}(?:\\s*[:—–-]\\s*(.+))?$`;
const EN_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const HE_WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const RU_WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];

const IDENTIFIER = new RegExp(`^${TASK_ID}\\??$`, 'i');
const START = /^start(?:\s+(\S+))?$/i;
const MENTION = /@[a-z0-9_]*bot\b|<@!?\d+>/gi;
const COMMA_SPLIT = /\s*(?:,|&)\s*/;
const LINK = /https?:\/\//i;

const date = (day: string, month: string): When => ({ kind: 'date', day: Number(day), month: Number(month) });

const splitOn = (pattern: RegExp) => (text: string) => text.split(pattern);

const splitHebrew = (text: string) => {
  const parts = text.split(COMMA_SPLIT);
  return parts.length > 1 ? [...parts.slice(0, -1), ...parts.at(-1)!.split(/\s+ו(?=\S)/)] : parts;
};

const keywords = (entries: [string[], Command][]) =>
  Object.fromEntries(entries.flatMap(([words, command]) => words.map((word) => [word, command] as const)));

const GRAMMARS: Record<BotLanguage, Grammar> = {
  en: {
    keywords: keywords([
      [['help'], { kind: 'help' }],
      [['?', 'lists?', 'lists'], { kind: 'lists' }],
      [['chores?', 'chores', 'tasks?', 'tasks'], { kind: 'tasks' }],
      [['mine?', 'mine', 'my tasks?', 'my tasks'], { kind: 'mine' }],
      [['appointments?', 'appointments'], { kind: 'appointments' }],
    ]),
    done: new RegExp(`^(?:done|finished|close)${DONE_TAIL}`, 'i'),
    use: new RegExp(`^use\\s+${KEY}$`, 'i'),
    openProject: /^open\s+(?:the\s+)?(?:project|board)(?:\s+page)?$/i,
    openLists: /^open\s+(?:the\s+)?(?:shopping\s+)?lists?(?:\s+page)?$/i,
    openList: /^open\s+(?:the\s+)?(.+?)\s+list(?:\s+page)?$/i,
    addToList: /^add\s+(.+?)\s+to\s+(?:the\s+|my\s+)?(.+?)(?:\s+shopping)?\s+list$/i,
    add: /^add\s+(.+)$/i,
    bought: /^(?:i\s+)?(?:bought|got)\s+(.+)$/i,
    assign: /^(.+?)\s+(?:needs?|has|have)\s+to\s+(.+)$/i,
    when: /\s+(today|tonight|tomorrow|(?:on\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday)?|on\s+(\d{1,2})[/.](\d{1,2}))$/i,
    whenOf: (match) => {
      const word = match[1]!.toLowerCase();
      if (word === 'today' || word === 'tonight') return { kind: 'today' };
      if (word === 'tomorrow') return { kind: 'tomorrow' };
      if (match[3]) return date(match[3], match[4]!);
      return { kind: 'weekday', day: EN_WEEKDAYS.indexOf(match[2]!.toLowerCase().slice(0, 3)) };
    },
    split: splitOn(/\s*(?:,|&|\band\b)\s*/i),
  },
  he: {
    keywords: keywords([
      [['עזרה', 'עזרה?'], { kind: 'help' }],
      [['רשימות?', 'רשימות'], { kind: 'lists' }],
      [['מטלות?', 'מטלות', 'משימות?', 'משימות'], { kind: 'tasks' }],
      [['שלי?', 'שלי', 'המשימות שלי?', 'המשימות שלי', 'המטלות שלי?', 'המטלות שלי'], { kind: 'mine' }],
      [['פגישות?', 'פגישות', 'תורים?', 'תורים'], { kind: 'appointments' }],
    ]),
    done: new RegExp(`^(?:בוצע|סיימתי|גמרתי|סגור)${DONE_TAIL}`, 'iu'),
    use: new RegExp(`^(?:עבור\\s+ל|השתמש\\s+ב)-?\\s*${KEY}$`, 'iu'),
    openProject: /^(?:פתח|תפתח|פתחי)\s+(?:את\s+)?ה?(?:פרויקט|לוח)$/u,
    openLists: /^(?:פתח|תפתח|פתחי)\s+(?:את\s+)?ה?רשימות(?:\s+ה?קניות)?$/u,
    openList: /^(?:פתח|תפתח|פתחי)\s+(?:את\s+)?ה?רשימת\s+(.+)$/u,
    addToList: /^(?:הוסף|תוסיף|תוסיפי|הוסיפי)\s+(.+?)\s+לרשימ(?:ת|ה)\s+(.+)$/u,
    add: /^(?:הוסף|תוסיף|תוסיפי|הוסיפי)\s+(.+)$/u,
    bought: /^(?:קניתי|קנינו|קנה|קנתה|קיבלתי)\s+(.+)$/u,
    assign: /^(.+?)\s+(?:צריך|צריכה|צריכים|צריכות|חייב|חייבת)\s+(.+)$/u,
    when: /\s+(היום|הערב|מחרתיים|מחר|(?:ב)?יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי)|ב?שבת|ב-?(\d{1,2})[/.](\d{1,2}))$/u,
    whenOf: (match) => {
      const word = match[1]!;
      if (word === 'היום' || word === 'הערב') return { kind: 'today' };
      if (word === 'מחר') return { kind: 'tomorrow' };
      if (word === 'מחרתיים') return { kind: 'days', days: 2 };
      if (match[3]) return date(match[3], match[4]!);
      return { kind: 'weekday', day: HE_WEEKDAYS.indexOf(match[2] ?? 'שבת') };
    },
    split: splitHebrew,
  },
  ru: {
    keywords: keywords([
      [['помощь', 'помощь?'], { kind: 'help' }],
      [['списки?', 'списки'], { kind: 'lists' }],
      [['дела?', 'дела', 'задачи?', 'задачи'], { kind: 'tasks' }],
      [['мои?', 'мои', 'мои задачи?', 'мои задачи', 'мои дела?', 'мои дела'], { kind: 'mine' }],
      [['встречи?', 'встречи', 'записи?', 'записи'], { kind: 'appointments' }],
    ]),
    done: new RegExp(`^(?:готово|сделано|сделал|сделала|закрыть|закрой)${DONE_TAIL}`, 'iu'),
    use: new RegExp(`^(?:используй|перейди\\s+(?:в|на)|переключись\\s+на)\\s+${KEY}$`, 'iu'),
    openProject: /^(?:открой|открыть)\s+(?:проект|доску)$/iu,
    openLists: /^(?:открой|открыть)\s+(?:списки|список\s+покупок)$/iu,
    openList: /^(?:открой|открыть)\s+список\s+(.+)$/iu,
    addToList: /^(?:добавь|добавьте|добавить)\s+(.+?)\s+в\s+список\s+(.+)$/iu,
    add: /^(?:добавь|добавьте|добавить)\s+(.+)$/iu,
    bought: /^(?:я\s+)?(?:купил|купила|купили|взял|взяла|взяли)\s+(.+)$/iu,
    assign: /^(.+?)\s+(?:должен|должна|должны|надо|нужно)\s+(.+)$/iu,
    when: /\s+(сегодня(?:\s+вечером)?|вечером|послезавтра|завтра|во?\s+(воскресенье|понедельник|вторник|среду|четверг|пятницу|субботу)|на\s+(\d{1,2})[/.](\d{1,2}))$/iu,
    whenOf: (match) => {
      const word = match[1]!.toLowerCase();
      if (word.startsWith('сегодня') || word === 'вечером') return { kind: 'today' };
      if (word === 'завтра') return { kind: 'tomorrow' };
      if (word === 'послезавтра') return { kind: 'days', days: 2 };
      if (match[3]) return date(match[3], match[4]!);
      return { kind: 'weekday', day: RU_WEEKDAYS.indexOf(match[2]!.toLowerCase()) };
    },
    split: splitOn(/\s*(?:,|&)\s*|\s+и\s+/iu),
  },
};

const itemsOf = (grammar: Grammar, text: string) =>
  grammar
    .split(text)
    .map((item) => item.trim().slice(0, ITEM_MAX))
    .filter(Boolean)
    .slice(0, ITEMS_MAX);

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const assignOf = (grammar: Grammar, person: string, rest: string): Command => {
  const when = rest.match(grammar.when);
  const title = (when ? rest.slice(0, when.index) : rest).trim().slice(0, TITLE_MAX);
  return {
    kind: 'assign',
    person: person.trim(),
    title: capitalize(title),
    when: when ? grammar.whenOf(when) : null,
  };
};

const matchGrammar = (grammar: Grammar, text: string): Command | null => {
  const keyword = grammar.keywords[text.toLowerCase()];
  if (keyword) return keyword;
  let match: RegExpMatchArray | null;
  if ((match = text.match(grammar.done)))
    return { kind: 'done', identifier: match[1]!.toUpperCase(), decision: match[2]?.trim() || null };
  if ((match = text.match(grammar.use))) return { kind: 'use', key: match[1]!.toUpperCase() };
  if (grammar.openProject.test(text)) return { kind: 'open_project' };
  if (grammar.openLists.test(text)) return { kind: 'open_list', name: null };
  if ((match = text.match(grammar.openList))) return { kind: 'open_list', name: match[1]!.trim() };
  if ((match = text.match(grammar.addToList)))
    return { kind: 'add', items: itemsOf(grammar, match[1]!), list: match[2]!.trim() };
  if ((match = text.match(grammar.add)))
    return { kind: 'add', items: itemsOf(grammar, match[1]!), list: null };
  if ((match = text.match(grammar.bought))) return { kind: 'bought', items: itemsOf(grammar, match[1]!) };
  if ((match = text.match(grammar.assign))) return assignOf(grammar, match[1]!, match[2]!);
  return null;
};

export const parseCommand = (raw: string, language: BotLanguage = 'en'): Command => {
  const text = raw.replace(MENTION, '').replace(/^\//, '').replace(/\s+/g, ' ').trim();
  const grammar = GRAMMARS[language];
  let match: RegExpMatchArray | null;
  if ((match = text.match(START))) return match[1] ? { kind: 'start', code: match[1] } : { kind: 'help' };
  if ((match = text.match(IDENTIFIER))) return { kind: 'task', identifier: match[1]!.toUpperCase() };
  let matched: Grammar = grammar;
  let command = matchGrammar(grammar, text);
  if (!command && language !== 'en') {
    matched = GRAMMARS.en;
    command = matchGrammar(matched, text);
  }
  if (LINK.test(text) && (!command || command.kind === 'add')) {
    const source =
      command?.kind === 'add' ? text.replace(command.list ? matched.addToList : matched.add, '$1') : text;
    const link = parseSharedLink({ text: source });
    if (link.url) return { kind: 'add_link', name: link.name, url: link.url, list: command?.list ?? null };
  }
  if (command) return command;
  if (text.endsWith('?') && text.length > 1) return { kind: 'list', name: text.slice(0, -1).trim() };
  return { kind: 'add', items: itemsOf(grammar, text), list: null };
};
