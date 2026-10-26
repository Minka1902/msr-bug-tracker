import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createItemSchema } from '@msr/shared/schemas/shopping';
import type { ShoppingList } from '@msr/shared/types';
import { z } from 'zod';
import { notFound } from '../../../lib/httpError';
import { assertCanWrite, findProjectContext } from '../../projects/access';
import { addItem, getList, listLists, updateItem } from '../../shopping/service';
import { projectUrl } from '../format';
import { READ, run, WRITE, type ToolContext } from '../tool';

const projectKey = z.string().trim().min(2).max(6).describe('Household project key');
const listName = z.string().trim().max(60).optional().describe('List name; defaults to the first list');

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const compactList = (list: ShoppingList) => ({
  list: list.name,
  items: list.items.map((item) => ({
    name: item.name,
    ...(item.quantity && { quantity: item.quantity }),
    checked: item.isChecked,
  })),
});

const pickList = (lists: ShoppingList[], name: string | undefined) => {
  const list = name ? lists.find((item) => same(item.name, name)) : lists[0];
  if (!list)
    throw notFound(
      lists.length
        ? `No list called "${name}". Lists: ${lists.map((item) => `"${item.name}"`).join(', ')}`
        : 'This project has no shopping lists yet',
    );
  return list;
};

export const registerHouseholdTools = (server: McpServer, context: ToolContext) => {
  const { user } = context;

  server.registerTool(
    'list_shopping_lists',
    {
      title: 'Shopping lists',
      description: 'Shows the shopping lists of a household project and what is on them.',
      inputSchema: { projectKey },
      annotations: READ,
    },
    run(async (input) => {
      const project = await findProjectContext(input.projectKey.toUpperCase(), user.id);
      return {
        lists: (await listLists(project.id)).map(compactList),
        url: projectUrl(`${project.key}/shopping`),
      };
    }),
  );

  if (!context.canWrite) return;

  server.registerTool(
    'add_shopping_items',
    {
      title: 'Add to a shopping list',
      description: 'Adds items to a household shopping list.',
      inputSchema: {
        projectKey,
        list: listName,
        items: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(120),
              quantity: z.string().trim().max(40).optional(),
            }),
          )
          .min(1)
          .max(30),
      },
      annotations: WRITE,
    },
    run(async (input) => {
      const project = await findProjectContext(input.projectKey.toUpperCase(), user.id);
      assertCanWrite(project, 'lists.edit');
      const list = pickList(await listLists(project.id), input.list);
      for (const item of input.items) await addItem(list.id, createItemSchema.parse(item), user.id);
      return compactList((await getList(project.id, list.id))!);
    }),
  );

  server.registerTool(
    'check_shopping_items',
    {
      title: 'Tick off shopping items',
      description: 'Marks items on a shopping list as bought, or unticks them.',
      inputSchema: {
        projectKey,
        list: listName,
        items: z.array(z.string().trim().min(1).max(120)).min(1).max(50).describe('Item names'),
        checked: z.boolean().default(true),
      },
      annotations: { ...WRITE, idempotentHint: true },
    },
    run(async (input) => {
      const project = await findProjectContext(input.projectKey.toUpperCase(), user.id);
      assertCanWrite(project, 'lists.edit');
      const list = pickList(await listLists(project.id), input.list);
      const missing = input.items.filter((name) => !list.items.some((item) => same(item.name, name)));
      if (missing.length) throw notFound(`Not on "${list.name}": ${missing.join(', ')}`);
      for (const item of list.items.filter((entry) => input.items.some((name) => same(entry.name, name))))
        await updateItem(project.id, list.id, item.id, { isChecked: input.checked }, user.id);
      return compactList((await getList(project.id, list.id))!);
    }),
  );
};
