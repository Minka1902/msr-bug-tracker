import { z } from 'zod';
import { emptyTask, type NormalizedTask } from '../../importer/types';
import { categoryFromName, parseType, toIsoDate, toIsoTimestamp } from '../../importer/values';
import { sourceRequest } from '../http';
import type { MigrationAdapter } from '../types';

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
  idMembers: string[];
  labels: { name: string; color: string | null }[];
  due: string | null;
  start: string | null;
  closed: boolean;
  checklists?: { checkItems: { name: string; state: string; pos: number }[] }[];
}

interface TrelloAction {
  date: string;
  data: { text: string; card: { id: string } };
  memberCreator?: { fullName?: string; username?: string };
}

const API = 'https://api.trello.com/1';
const LABEL = 'Trello';
const ACTIONS_PAGE = 1000;

const credentials = z.object({
  key: z.string().trim().min(10, 'Paste your Trello API key'),
  token: z.string().trim().min(10, 'Paste your Trello token'),
});
type Credentials = z.infer<typeof credentials>;

const get = <T>({ key, token }: Credentials, path: string) =>
  sourceRequest<T>(LABEL, `${API}${path}`, {
    headers: { Authorization: `OAuth oauth_consumer_key="${key}", oauth_token="${token}"` },
  });

const createdFromId = (id: string) => new Date(parseInt(id.slice(0, 8), 16) * 1000).toISOString();

export const trello: MigrationAdapter<Credentials> = {
  label: LABEL,
  credentials,
  listSources: async (creds) => {
    const boards = await get<{ id: string; name: string }[]>(
      creds,
      '/members/me/boards?filter=open&fields=name',
    );
    return boards.map((board) => ({ id: board.id, name: board.name, group: null }));
  },
  fetchSource: async (creds, boardId, options, progress) => {
    const [board, lists, members, cards] = await Promise.all([
      get<{ name: string }>(creds, `/boards/${boardId}?fields=name`),
      get<{ id: string; name: string }[]>(creds, `/boards/${boardId}/lists?filter=all&fields=name`),
      get<{ id: string; fullName: string; username: string }[]>(
        creds,
        `/boards/${boardId}/members?fields=fullName,username`,
      ),
      get<TrelloCard[]>(
        creds,
        `/boards/${boardId}/cards/${options.includeClosed ? 'all' : 'open'}?checklists=all&fields=name,desc,idList,idMembers,labels,due,start,closed`,
      ),
    ]);
    progress('Reading cards', cards.length, cards.length);
    const listName = new Map(lists.map((list) => [list.id, list.name]));
    const memberById = new Map(members.map((member) => [member.id, member]));
    const comments = new Map<string, NormalizedTask['comments']>();
    if (options.includeComments) {
      let before = '';
      while (true) {
        const actions = await get<TrelloAction[]>(
          creds,
          `/boards/${boardId}/actions?filter=commentCard&limit=${ACTIONS_PAGE}${before ? `&before=${before}` : ''}`,
        );
        actions.forEach((action) => {
          const list = comments.get(action.data.card.id) ?? [];
          list.push({
            author: {
              email: null,
              name: action.memberCreator?.fullName ?? action.memberCreator?.username ?? null,
            },
            body: action.data.text,
            createdAt: toIsoTimestamp(action.date),
          });
          comments.set(action.data.card.id, list);
        });
        if (actions.length < ACTIONS_PAGE) break;
        before = actions.at(-1)!.date;
      }
    }
    const tasks = cards.map((card): NormalizedTask => {
      const member = card.idMembers[0] ? memberById.get(card.idMembers[0]) : undefined;
      const status = listName.get(card.idList) ?? 'To do';
      return {
        ...emptyTask(card.name),
        externalId: card.id,
        description: card.desc,
        type: parseType(card.labels.map((label) => label.name).join(' ')),
        status,
        statusCategory: card.closed ? 'done' : categoryFromName(status),
        assignee: member ? { email: null, name: member.fullName || member.username } : null,
        labels: card.labels.map((label) => label.name || label.color || '').filter(Boolean),
        startDate: toIsoDate(card.start),
        dueDate: toIsoDate(card.due),
        createdAt: createdFromId(card.id),
        checklist: (card.checklists ?? []).flatMap((list) =>
          [...list.checkItems]
            .sort((a, b) => a.pos - b.pos)
            .map((item) => ({ text: item.name, done: item.state === 'complete' })),
        ),
        comments: (comments.get(card.id) ?? []).reverse(),
      };
    });
    return {
      name: board.name,
      tasks,
      statusCategories: Object.fromEntries(
        lists.map((list) => [list.name, categoryFromName(list.name) ?? 'todo']),
      ),
    };
  },
};
