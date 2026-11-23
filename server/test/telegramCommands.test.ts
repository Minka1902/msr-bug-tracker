import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src/modules/bots/commands';
import { detectLanguage } from '../src/modules/bots/language';

describe('Telegram command parser', () => {
  it.each([
    ['/start abc_DEF-123', { kind: 'start', code: 'abc_DEF-123' }],
    ['/start', { kind: 'help' }],
    ['/help@msr_family_bot', { kind: 'help' }],
    ['HELP', { kind: 'help' }],
    ['use home', { kind: 'use', key: 'HOME' }],
    ['?', { kind: 'lists' }],
    ['chores?', { kind: 'tasks' }],
    ['/tasks', { kind: 'tasks' }],
    ['Mine?', { kind: 'mine' }],
    ['my tasks?', { kind: 'mine' }],
    ['appointments?', { kind: 'appointments' }],
    ['groceries?', { kind: 'list', name: 'groceries' }],
    ['hardware store?', { kind: 'list', name: 'hardware store' }],
    ['home-12?', { kind: 'task', identifier: 'HOME-12' }],
    ['WEB-3', { kind: 'task', identifier: 'WEB-3' }],
    ['done home-12', { kind: 'done', identifier: 'HOME-12', decision: null }],
    [
      'done HOME-12: we go with the blue sofa',
      { kind: 'done', identifier: 'HOME-12', decision: 'we go with the blue sofa' },
    ],
    ['close home-3 - Rent the van', { kind: 'done', identifier: 'HOME-3', decision: 'Rent the van' }],
    ['open project page', { kind: 'open_project' }],
    ['open the board', { kind: 'open_project' }],
    ['open list page', { kind: 'open_list', name: null }],
    ['open shopping lists', { kind: 'open_list', name: null }],
    ['open groceries list page', { kind: 'open_list', name: 'groceries' }],
    ['open the hardware store list', { kind: 'open_list', name: 'hardware store' }],
    ['add apples to store shopping list', { kind: 'add', items: ['apples'], list: 'store' }],
    [
      'add apples, milk to the hardware store list',
      { kind: 'add', items: ['apples', 'milk'], list: 'hardware store' },
    ],
    ['add bread and butter', { kind: 'add', items: ['bread', 'butter'], list: null }],
    ['apples', { kind: 'add', items: ['apples'], list: null }],
    ['eggs, milk & cheese', { kind: 'add', items: ['eggs', 'milk', 'cheese'], list: null }],
    ['i bought apples and cheese', { kind: 'bought', items: ['apples', 'cheese'] }],
    ['got milk', { kind: 'bought', items: ['milk'] }],
    [
      'michael needs to wash the car today',
      { kind: 'assign', person: 'michael', title: 'Wash the car', when: { kind: 'today' } },
    ],
    [
      'Dana has to call grandma tomorrow',
      { kind: 'assign', person: 'Dana', title: 'Call grandma', when: { kind: 'tomorrow' } },
    ],
    [
      'mia rose needs to feed the cat on friday',
      { kind: 'assign', person: 'mia rose', title: 'Feed the cat', when: { kind: 'weekday', day: 5 } },
    ],
    [
      'tom needs to pay rent on 12/11',
      { kind: 'assign', person: 'tom', title: 'Pay rent', when: { kind: 'date', day: 12, month: 11 } },
    ],
    ['tom needs to tidy up', { kind: 'assign', person: 'tom', title: 'Tidy up', when: null }],
    ['I have to call the plumber', { kind: 'assign', person: 'I', title: 'Call the plumber', when: null }],
  ])('%s', (text, command) => {
    expect(parseCommand(text)).toEqual(command);
  });

  it('caps the number and length of items', () => {
    const command = parseCommand(Array.from({ length: 40 }, (_, index) => `item${index}`).join(', '));
    expect(command).toMatchObject({ kind: 'add', list: null });
    expect((command as { items: string[] }).items).toHaveLength(30);
    expect((parseCommand('x'.repeat(200)) as { items: string[] }).items[0]).toHaveLength(120);
  });

  it('keeps words that only contain "and"', () => {
    expect(parseCommand('candles, sandpaper')).toEqual({
      kind: 'add',
      items: ['candles', 'sandpaper'],
      list: null,
    });
  });
});

describe('language detection', () => {
  it.each([
    ['apples, milk', 'en'],
    ['קניתי חלב', 'he'],
    ['סגור HOME-12', 'he'],
    ['купил молоко', 'ru'],
    ['готово HOME-12', 'ru'],
    ['?', null],
    ['HOME-12?', null],
    ['use HOME', 'en'],
    ['12/11', null],
    ['/start abc123', null],
    ['/tasks@msr_bot', null],
  ])('%s', (text, language) => {
    expect(detectLanguage(text)).toBe(language);
  });
});

describe('Hebrew commands', () => {
  it.each([
    ['עזרה', { kind: 'help' }],
    ['רשימות?', { kind: 'lists' }],
    ['מטלות?', { kind: 'tasks' }],
    ['משימות', { kind: 'tasks' }],
    ['שלי?', { kind: 'mine' }],
    ['המשימות שלי?', { kind: 'mine' }],
    ['תורים?', { kind: 'appointments' }],
    ['פגישות?', { kind: 'appointments' }],
    ['עבור ל home', { kind: 'use', key: 'HOME' }],
    ['סגור home-12', { kind: 'done', identifier: 'HOME-12', decision: null }],
    [
      'בוצע HOME-12: קונים את הספה הכחולה',
      { kind: 'done', identifier: 'HOME-12', decision: 'קונים את הספה הכחולה' },
    ],
    ['done HOME-3', { kind: 'done', identifier: 'HOME-3', decision: null }],
    ['פתח את הפרויקט', { kind: 'open_project' }],
    ['פתח את רשימות הקניות', { kind: 'open_list', name: null }],
    ['פתח את רשימת סופר', { kind: 'open_list', name: 'סופר' }],
    ['הוסף מסמרים לרשימת כלי עבודה', { kind: 'add', items: ['מסמרים'], list: 'כלי עבודה' }],
    ['תוסיף חלב, לחם', { kind: 'add', items: ['חלב', 'לחם'], list: null }],
    ['חלב, ביצים וגבינה', { kind: 'add', items: ['חלב', 'ביצים', 'גבינה'], list: null }],
    ['תמצית וניל', { kind: 'add', items: ['תמצית וניל'], list: null }],
    ['קניתי חלב, לחם', { kind: 'bought', items: ['חלב', 'לחם'] }],
    ['קנינו ביצים', { kind: 'bought', items: ['ביצים'] }],
    ['סופר?', { kind: 'list', name: 'סופר' }],
    [
      'דנה צריכה לשטוף את האוטו מחר',
      { kind: 'assign', person: 'דנה', title: 'לשטוף את האוטו', when: { kind: 'tomorrow' } },
    ],
    [
      'אבא צריך לקנות מתנה היום',
      { kind: 'assign', person: 'אבא', title: 'לקנות מתנה', when: { kind: 'today' } },
    ],
    [
      'תום צריך לשלם ארנונה מחרתיים',
      { kind: 'assign', person: 'תום', title: 'לשלם ארנונה', when: { kind: 'days', days: 2 } },
    ],
    [
      'מיה צריכה להאכיל את החתול ביום שישי',
      { kind: 'assign', person: 'מיה', title: 'להאכיל את החתול', when: { kind: 'weekday', day: 5 } },
    ],
    [
      'רון צריך לסדר את החדר בשבת',
      { kind: 'assign', person: 'רון', title: 'לסדר את החדר', when: { kind: 'weekday', day: 6 } },
    ],
    [
      'אני צריך לתקן את הברז ב-12/11',
      { kind: 'assign', person: 'אני', title: 'לתקן את הברז', when: { kind: 'date', day: 12, month: 11 } },
    ],
  ])('%s', (text, command) => {
    expect(parseCommand(text, 'he')).toEqual(command);
  });
});

describe('Russian commands', () => {
  it.each([
    ['помощь', { kind: 'help' }],
    ['списки?', { kind: 'lists' }],
    ['дела?', { kind: 'tasks' }],
    ['задачи', { kind: 'tasks' }],
    ['мои?', { kind: 'mine' }],
    ['мои задачи?', { kind: 'mine' }],
    ['встречи?', { kind: 'appointments' }],
    ['перейди в home', { kind: 'use', key: 'HOME' }],
    ['готово home-12', { kind: 'done', identifier: 'HOME-12', decision: null }],
    [
      'сделано HOME-12: берём синий диван',
      { kind: 'done', identifier: 'HOME-12', decision: 'берём синий диван' },
    ],
    ['открой проект', { kind: 'open_project' }],
    ['открой списки', { kind: 'open_list', name: null }],
    ['открой список продукты', { kind: 'open_list', name: 'продукты' }],
    ['добавь гвозди в список инструменты', { kind: 'add', items: ['гвозди'], list: 'инструменты' }],
    ['добавь хлеб и масло', { kind: 'add', items: ['хлеб', 'масло'], list: null }],
    ['молоко, яйца и сыр', { kind: 'add', items: ['молоко', 'яйца', 'сыр'], list: null }],
    ['я купил молоко', { kind: 'bought', items: ['молоко'] }],
    ['купила хлеб и сыр', { kind: 'bought', items: ['хлеб', 'сыр'] }],
    ['продукты?', { kind: 'list', name: 'продукты' }],
    [
      'Дана должна помыть машину завтра',
      { kind: 'assign', person: 'Дана', title: 'Помыть машину', when: { kind: 'tomorrow' } },
    ],
    [
      'папа должен купить подарок сегодня',
      { kind: 'assign', person: 'папа', title: 'Купить подарок', when: { kind: 'today' } },
    ],
    [
      'Том должен заплатить послезавтра',
      { kind: 'assign', person: 'Том', title: 'Заплатить', when: { kind: 'days', days: 2 } },
    ],
    [
      'Миша должен покормить кота в пятницу',
      { kind: 'assign', person: 'Миша', title: 'Покормить кота', when: { kind: 'weekday', day: 5 } },
    ],
    [
      'Оля должна убрать комнату во вторник',
      { kind: 'assign', person: 'Оля', title: 'Убрать комнату', when: { kind: 'weekday', day: 2 } },
    ],
    [
      'я должен починить кран на 12/11',
      { kind: 'assign', person: 'я', title: 'Починить кран', when: { kind: 'date', day: 12, month: 11 } },
    ],
  ])('%s', (text, command) => {
    expect(parseCommand(text, 'ru')).toEqual(command);
  });
});

describe('shared links', () => {
  it.each([
    [
      'I just found this on AliExpress: US $12.34 | Garden Hose 30m https://a.aliexpress.com/_mKxyz12',
      'en',
      { kind: 'add_link', name: 'Garden Hose 30m', url: 'https://a.aliexpress.com/_mKxyz12', list: null },
    ],
    [
      'add https://a.co/d/abc123 to the hardware list',
      'en',
      { kind: 'add_link', name: 'Amazon item', url: 'https://a.co/d/abc123', list: 'hardware' },
    ],
    [
      'add https://a.co/d/x',
      'en',
      { kind: 'add_link', name: 'Amazon item', url: 'https://a.co/d/x', list: null },
    ],
    [
      'הוסף https://a.co/d/x',
      'he',
      { kind: 'add_link', name: 'Amazon item', url: 'https://a.co/d/x', list: null },
    ],
    [
      'https://il.shein.com/Floral-Midi-Dress-p-123.html',
      'he',
      {
        kind: 'add_link',
        name: 'Floral Midi Dress',
        url: 'https://il.shein.com/Floral-Midi-Dress-p-123.html',
        list: null,
      },
    ],
  ])('%s', (text, language, command) => {
    expect(parseCommand(text, language as 'en' | 'he')).toEqual(command);
  });

  it('keeps links inside a decision', () => {
    expect(parseCommand('done HOME-3: we chose https://a.co/d/x')).toEqual({
      kind: 'done',
      identifier: 'HOME-3',
      decision: 'we chose https://a.co/d/x',
    });
  });
});
