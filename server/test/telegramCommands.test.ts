import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src/modules/telegram/commands';

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
    ['done home-12', { kind: 'done', identifier: 'HOME-12' }],
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
