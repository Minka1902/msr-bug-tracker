import { formatMinutes } from '@msr/shared/calendar';
import type { Priority } from '@msr/shared/enums';
import type { Formatter } from './format';
import type { BotLanguage } from './language';

export interface BotTexts {
  help: (f: Formatter, household: boolean) => string;
  me: string[];
  nothingToBuy: string;
  noList: (name: string, lists: string) => string;
  noListsYet: string;
  noLists: string;
  added: (items: string, list: string) => string;
  ticked: (items: string) => string;
  notOnLists: (items: string) => string;
  nothingOpen: (mine: boolean) => string;
  anyone: string;
  due: (day: string) => string;
  decisionExample: (identifier: string) => string;
  needsDecision: (identifier: string, example: string) => string;
  finished: (link: string) => string;
  noOne: (person: string, members: string) => string;
  whoDoYouMean: (names: string) => string;
  addedFor: (link: string, name: string, due: string | null) => string;
  noDate: string;
  noAppointments: string;
  notConnectedTo: (key: string) => string;
  nowIn: (key: string) => string;
  open: (name: string) => string;
  openLists: string;
  chatNotConnected: string;
  connectFirst: (name: string) => string;
  notMember: (name: string) => string;
  needsPlan: (bot: string, plan: string) => string;
  missingPermission: (message: string, missing: string) => string;
  failed: string;
  today: string;
  someone: string;
  priority: Record<Priority, string>;
  schedule: string;
  created: (task: string, assignee: string | null) => string;
  commented: (actor: string, task: string) => string;
  addedItems: (actor: string, items: string, list: string) => string;
  cleared: (actor: string, count: number, list: string) => string;
  addedEvent: (actor: string, appointment: boolean, title: string) => string;
  reminder: (title: string, wait: string) => string;
  duration: (minutes: number) => string;
  wasDue: (task: string, day: string) => string;
  dueToday: string;
  overdueSince: (day: string) => string;
  more: (count: number) => string;
}

const unitsOf = (minutes: number, labels: { day: string; days: string; hour: string; minute: string }) => {
  if (minutes >= 1440 && minutes % 1440 === 0)
    return minutes === 1440 ? labels.day : `${minutes / 1440} ${labels.days}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} ${labels.minute}`;
  return rest ? `${hours} ${labels.hour} ${rest} ${labels.minute}` : `${hours} ${labels.hour}`;
};

const ru = new Intl.PluralRules('ru');

const EN: BotTexts = {
  help: (f, household) =>
    [
      f.bold('What I understand'),
      ...(household
        ? [
            `• ${f.code('apples, milk')} or ${f.code('add apples to store list')}: add to a shopping list`,
            `• ${f.code('i bought apples and cheese')}: tick them off`,
            `• ${f.code('?')} or ${f.code('groceries?')}: what is on the lists`,
            `• ${f.code('open groceries list page')}: a link to a list`,
            `• ${f.code('appointments?')}: the next two weeks`,
          ]
        : []),
      `• ${f.code(household ? 'chores?' : 'tasks?')} / ${f.code('mine?')}: open work by person / yours`,
      `• ${f.code('michael needs to wash the car today')}: add a task for someone`,
      `• ${f.code('KEY-12?')} / ${f.code('done KEY-12')}: look up or finish a task`,
      `• ${f.code('done KEY-12: we chose X')}: close a discussion with its decision`,
      `• ${f.code('open project page')} · ${f.code('use KEY')}: switch project`,
      `I also understand ${f.text('עברית')} and ${f.text('русский')}.`,
    ].join('\n'),
  me: ['i', 'me'],
  nothingToBuy: 'nothing to buy',
  noList: (name, lists) => `No list called "${name}". Lists: ${lists}`,
  noListsYet: 'This household has no shopping lists yet',
  noLists: 'No lists yet.',
  added: (items, list) => `Added ${items} to ${list}.`,
  ticked: (items) => `Ticked off ${items}.`,
  notOnLists: (items) => `Not on your lists: ${items}.`,
  nothingOpen: (mine) => (mine ? 'Nothing open for you. 🎉' : 'Nothing open. 🎉'),
  anyone: 'Anyone',
  due: (day) => `due ${day}`,
  decisionExample: (identifier) => `done ${identifier}: what you decided`,
  needsDecision: (identifier, example) =>
    `${identifier} is a discussion. Close it with its decision: ${example}`,
  finished: (link) => `Done: ${link} ✅`,
  noOne: (person, members) => `No one called "${person}" here. Members: ${members}`,
  whoDoYouMean: (names) => `Who do you mean: ${names}?`,
  addedFor: (link, name, due) => `Added ${link} for ${name}${due ? `, due ${due}` : ''}.`,
  noDate: 'That date does not exist',
  noAppointments: 'No appointments in the next two weeks.',
  notConnectedTo: (key) =>
    `This chat isn't connected to ${key}. Connect it from that project's Settings → Bots.`,
  nowIn: (key) => `Now working in ${key}.`,
  open: (name) => `Open ${name}`,
  openLists: 'Open the shopping lists',
  chatNotConnected: 'This chat is not connected yet. In MSR open a project → Settings → Bots.',
  connectFirst: (name) => `Connect your account first: MSR → ${name} → Settings → Bots → Connect me.`,
  notMember: (name) => `You are not a member of ${name}.`,
  needsPlan: (bot, plan) => `This project's ${bot} bot needs the ${plan} plan.`,
  missingPermission: (message, missing) => `${message} (missing permission: ${missing})`,
  failed: 'Something went wrong. Try again in a moment.',
  today: 'today',
  someone: 'Someone',
  priority: { low: 'low', medium: 'medium', high: 'high', urgent: 'urgent' },
  schedule: 'schedule',
  created: (task, assignee) => `🆕 ${task}${assignee ? ` for ${assignee}` : ''}`,
  commented: (actor, task) => `💬 ${actor} commented on ${task}`,
  addedItems: (actor, items, list) => `🛒 ${actor} added ${items} to ${list}`,
  cleared: (actor, count, list) =>
    `🛒 ${actor} cleared ${count} bought item${count === 1 ? '' : 's'} from ${list}`,
  addedEvent: (actor, appointment, title) =>
    `📅 ${actor} added ${appointment ? 'an appointment: ' : ''}${title}`,
  reminder: (title, wait) => `⏰ ${title} in ${wait}`,
  duration: formatMinutes,
  wasDue: (task, day) => `⏰ ${task} was due ${day}`,
  dueToday: 'Due today',
  overdueSince: (day) => `overdue since ${day}`,
  more: (count) => `…and ${count} more in MSR`,
};

const HE: BotTexts = {
  help: (f, household) =>
    [
      f.bold('מה אני מבין'),
      ...(household
        ? [
            `• ${f.code('חלב, לחם')} או ${f.code('הוסף מסמרים לרשימת כלי עבודה')}: הוספה לרשימת קניות`,
            `• ${f.code('קניתי חלב, לחם')}: סימון שנקנו`,
            `• ${f.code('?')} או ${f.code('סופר?')}: מה יש ברשימות`,
            `• ${f.code('פתח את רשימת סופר')}: קישור לרשימה`,
            `• ${f.code('תורים?')}: השבועיים הקרובים`,
          ]
        : []),
      `• ${f.code(household ? 'מטלות?' : 'משימות?')} / ${f.code('שלי?')}: מה פתוח לפי אדם / שלך`,
      `• ${f.code('דנה צריכה לשטוף את האוטו מחר')}: משימה בשביל מישהו`,
      `• ${f.code('KEY-12?')} / ${f.code('סגור KEY-12')}: חיפוש או סגירה של משימה`,
      `• ${f.code('סגור KEY-12: בחרנו ב-X')}: סגירת דיון עם ההחלטה`,
      `• ${f.code('פתח את הפרויקט')} · ${f.code('עבור ל KEY')}: החלפת פרויקט`,
      'כמה פריטים? הפרידו בפסיקים.',
    ].join('\n'),
  me: ['אני'],
  nothingToBuy: 'אין מה לקנות',
  noList: (name, lists) => `אין רשימה בשם "${name}". רשימות: ${lists}`,
  noListsYet: 'עוד אין רשימות קניות בבית הזה',
  noLists: 'עוד אין רשימות.',
  added: (items, list) => `הוספתי ${items} ל${list}.`,
  ticked: (items) => `סימנתי שנקנו: ${items}.`,
  notOnLists: (items) => `לא ברשימות: ${items}.`,
  nothingOpen: (mine) => (mine ? 'אין לך משימות פתוחות. 🎉' : 'אין משימות פתוחות. 🎉'),
  anyone: 'כל אחד',
  due: (day) => `עד ${day}`,
  decisionExample: (identifier) => `סגור ${identifier}: מה החלטתם`,
  needsDecision: (identifier, example) => `${identifier} הוא דיון. סגרו אותו עם ההחלטה: ${example}`,
  finished: (link) => `בוצע: ${link} ✅`,
  noOne: (person, members) => `אין כאן מישהו בשם "${person}". חברים: ${members}`,
  whoDoYouMean: (names) => `למי התכוונת: ${names}?`,
  addedFor: (link, name, due) => `הוספתי ${link} עבור ${name}${due ? `, עד ${due}` : ''}.`,
  noDate: 'התאריך הזה לא קיים',
  noAppointments: 'אין תורים בשבועיים הקרובים.',
  notConnectedTo: (key) => `הצ'אט הזה לא מחובר ל-${key}. חברו אותו מהגדרות הפרויקט → בוטים.`,
  nowIn: (key) => `עובדים עכשיו ב-${key}.`,
  open: (name) => `פתח את ${name}`,
  openLists: 'פתח את רשימות הקניות',
  chatNotConnected: "הצ'אט הזה עוד לא מחובר. ב-MSR פתחו פרויקט → הגדרות → בוטים.",
  connectFirst: (name) => `קודם חברו את החשבון: MSR → ${name} → הגדרות → בוטים → חבר אותי.`,
  notMember: (name) => `את/ה לא חבר/ה ב-${name}.`,
  needsPlan: (bot, plan) => `בוט ה-${bot} של הפרויקט הזה דורש את מסלול ${plan}.`,
  missingPermission: (message, missing) => `${message} (חסרה הרשאה: ${missing})`,
  failed: 'משהו השתבש. נסו שוב בעוד רגע.',
  today: 'היום',
  someone: 'מישהו',
  priority: { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', urgent: 'דחופה' },
  schedule: 'תזמון',
  created: (task, assignee) => `🆕 ${task}${assignee ? ` עבור ${assignee}` : ''}`,
  commented: (actor, task) => `💬 תגובה חדשה מ${actor} על ${task}`,
  addedItems: (actor, items, list) => `🛒 נוסף ל${list} (${actor}): ${items}`,
  cleared: (actor, count, list) =>
    `🛒 ${count === 1 ? 'פריט אחד שנקנה נוקה' : `${count} פריטים שנקנו נוקו`} מ${list} (${actor})`,
  addedEvent: (actor, appointment, title) =>
    `📅 ${appointment ? 'תור חדש' : 'אירוע חדש'} (${actor}): ${title}`,
  reminder: (title, wait) => `⏰ ${title} בעוד ${wait}`,
  duration: (minutes) => unitsOf(minutes, { day: 'יום', days: 'ימים', hour: 'שע׳', minute: 'דק׳' }),
  wasDue: (task, day) => `⏰ ${task} — היעד היה ${day}`,
  dueToday: 'להיום',
  overdueSince: (day) => `באיחור מאז ${day}`,
  more: (count) => `…ועוד ${count} ב-MSR`,
};

const RU: BotTexts = {
  help: (f, household) =>
    [
      f.bold('Что я понимаю'),
      ...(household
        ? [
            `• ${f.code('молоко, хлеб')} или ${f.code('добавь гвозди в список инструменты')}: добавить в список покупок`,
            `• ${f.code('купил молоко и хлеб')}: отметить купленное`,
            `• ${f.code('?')} или ${f.code('продукты?')}: что в списках`,
            `• ${f.code('открой список продукты')}: ссылка на список`,
            `• ${f.code('встречи?')}: ближайшие две недели`,
          ]
        : []),
      `• ${f.code('дела?')} / ${f.code('мои?')}: открытые задачи по людям / ваши`,
      `• ${f.code('Дана должна помыть машину завтра')}: задача для кого-то`,
      `• ${f.code('KEY-12?')} / ${f.code('готово KEY-12')}: найти или закрыть задачу`,
      `• ${f.code('готово KEY-12: выбрали X')}: закрыть обсуждение с решением`,
      `• ${f.code('открой проект')} · ${f.code('перейди в KEY')}: сменить проект`,
    ].join('\n'),
  me: ['я'],
  nothingToBuy: 'покупать нечего',
  noList: (name, lists) => `Нет списка "${name}". Списки: ${lists}`,
  noListsYet: 'В этом доме ещё нет списков покупок',
  noLists: 'Списков пока нет.',
  added: (items, list) => `Добавлено в ${list}: ${items}.`,
  ticked: (items) => `Отмечено как купленное: ${items}.`,
  notOnLists: (items) => `Нет в списках: ${items}.`,
  nothingOpen: (mine) => (mine ? 'У вас нет открытых задач. 🎉' : 'Открытых задач нет. 🎉'),
  anyone: 'Кто угодно',
  due: (day) => `срок ${day}`,
  decisionExample: (identifier) => `готово ${identifier}: что решили`,
  needsDecision: (identifier, example) =>
    `${identifier} — это обсуждение. Закройте его с решением: ${example}`,
  finished: (link) => `Готово: ${link} ✅`,
  noOne: (person, members) => `Здесь нет никого по имени "${person}". Участники: ${members}`,
  whoDoYouMean: (names) => `Кого вы имеете в виду: ${names}?`,
  addedFor: (link, name, due) => `Добавлено ${link} для ${name}${due ? `, срок ${due}` : ''}.`,
  noDate: 'Такой даты нет',
  noAppointments: 'Нет встреч в ближайшие две недели.',
  notConnectedTo: (key) => `Этот чат не подключён к ${key}. Подключите его в настройках проекта → Боты.`,
  nowIn: (key) => `Теперь работаем в ${key}.`,
  open: (name) => `Открыть ${name}`,
  openLists: 'Открыть списки покупок',
  chatNotConnected: 'Этот чат ещё не подключён. В MSR откройте проект → Настройки → Боты.',
  connectFirst: (name) => `Сначала подключите аккаунт: MSR → ${name} → Настройки → Боты → Подключить меня.`,
  notMember: (name) => `Вы не участник ${name}.`,
  needsPlan: (bot, plan) => `Боту ${bot} этого проекта нужен тариф ${plan}.`,
  missingPermission: (message, missing) => `${message} (нет права: ${missing})`,
  failed: 'Что-то пошло не так. Попробуйте ещё раз чуть позже.',
  today: 'сегодня',
  someone: 'Кто-то',
  priority: { low: 'низкий', medium: 'средний', high: 'высокий', urgent: 'срочный' },
  schedule: 'по расписанию',
  created: (task, assignee) => `🆕 ${task}${assignee ? ` для ${assignee}` : ''}`,
  commented: (actor, task) => `💬 Новый комментарий от ${actor}: ${task}`,
  addedItems: (actor, items, list) => `🛒 Добавлено в ${list} (${actor}): ${items}`,
  cleared: (actor, count, list) =>
    `🛒 Из ${list} убрано купленное: ${count} ${{ one: 'пункт', few: 'пункта' }[ru.select(count) as 'one' | 'few'] ?? 'пунктов'} (${actor})`,
  addedEvent: (actor, appointment, title) =>
    `📅 ${appointment ? 'Новая запись' : 'Новое событие'} (${actor}): ${title}`,
  reminder: (title, wait) => `⏰ ${title} через ${wait}`,
  duration: (minutes) => unitsOf(minutes, { day: '1 день', days: 'дн.', hour: 'ч', minute: 'мин' }),
  wasDue: (task, day) => `⏰ ${task} — срок был ${day}`,
  dueToday: 'На сегодня',
  overdueSince: (day) => `просрочено с ${day}`,
  more: (count) => `…и ещё ${count} в MSR`,
};

export const BOT_TEXT: Record<BotLanguage, BotTexts> = { en: EN, he: HE, ru: RU };
