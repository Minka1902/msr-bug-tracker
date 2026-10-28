import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../src/db/pool';
import { saveApiKey } from '../src/modules/aiKeys/service';
import { agentFor, createProject, registerUser, resetDb, setupTeam, type Agent } from './helpers';
import { connect } from './mcpHelpers';

beforeEach(resetDb);
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const claudeMessage = (data: unknown) =>
  json(200, {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text: JSON.stringify(data) }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  });

const openAiAnswer = (content: string) =>
  json(200, { choices: [{ message: { role: 'assistant', content } }] });

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const IDEA = { module: 'skill', name: 'Learn Spanish', description: 'Hold a conversation by summer' };

const signUp = async () => {
  const agent = agentFor();
  const { user } = await registerUser(agent);
  return { agent, id: user.id };
};

const PLAN = {
  tasks: [
    {
      title: 'Pick a course',
      doer: 'human',
      summary: 'Choose one.',
      steps: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
      skill: null,
      prompt: 'ignored',
    },
    {
      title: 'List 100 common words',
      doer: 'ai',
      summary: 'Word list.',
      steps: ['ignored'],
      skill: 'ignored',
      prompt: 'Write the 100 most common Spanish words with translations.',
    },
    { title: '  ', doer: 'human', summary: '', steps: [], skill: null, prompt: null },
    {
      title: 'Practice greetings',
      doer: 'human',
      summary: 'Say hi.',
      steps: ['Record yourself'],
      skill: null,
      prompt: null,
    },
    {
      title: 'Brainstorm topics',
      doer: 'skill',
      summary: 'Topics to talk about.',
      steps: [],
      skill: '/brainstorming',
      prompt: 'Find conversation topics.',
    },
    {
      title: 'Book a tutor',
      doer: 'human',
      summary: 'One lesson.',
      steps: ['Search', 'Book'],
      skill: null,
      prompt: null,
    },
  ],
};

describe('AI planner', () => {
  it('needs an AI key', async () => {
    const { agent } = await signUp();
    const { body } = await agent.post('/api/planner/questions').send(IDEA).expect(400);
    expect(body.error).toBe('Add an AI key in Settings → AI to plan with AI');
  });

  it('asks Claude clarifying questions with the module prompt', async () => {
    const { agent, id } = await signUp();
    await saveApiKey(id, 'anthropic', 'sk-ant-test-key-0000');
    const fetchMock = vi.fn().mockResolvedValue(
      claudeMessage({
        questions: Array.from({ length: 8 }, (_, index) => ({
          question: `Question ${index + 1}?`,
          choices: index === 0 ? ['A', ' ', 'x'.repeat(200), 'B', 'C', 'D', 'E', 'F'] : [],
        })),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { body } = await agent.post('/api/planner/questions').send(IDEA).expect(200);
    expect(body.questions).toHaveLength(6);
    expect(body.questions[0].choices).toEqual(['A', 'x'.repeat(120), 'B', 'C', 'D', 'E']);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('api.anthropic.com/v1/messages');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer sk-ant-test-key-0000');
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({
      model: 'claude-opus-5-5',
      fallbacks: 'default',
      output_config: { effort: 'medium' },
    });
    expect(sent.output_config.format.type).toBe('json_schema');
    expect(sent.messages[0].content).toContain('This is skill development');
    expect(sent.messages[0].content).toContain('Idea: Learn Spanish');
  });

  it('drafts a paced plan with the default AI and the motivation settings', async () => {
    const { agent, id } = await signUp();
    await saveApiKey(id, 'anthropic', 'sk-ant-test-key-0000');
    await saveApiKey(id, 'openai', 'sk-proj-test-key-0000');
    await agent
      .patch('/api/me')
      .send({
        preferences: {
          aiProvider: 'openai',
          motivation: { pace: 'intense', taskSize: 'tiny', aiShare: 'human' },
        },
      })
      .expect(200);
    const fetchMock = vi.fn().mockResolvedValue(openAiAnswer(JSON.stringify(PLAN)));
    vi.stubGlobal('fetch', fetchMock);
    const { body } = await agent
      .post('/api/planner/plan')
      .send({ ...IDEA, answers: [{ question: 'Your level?', answer: 'Beginner' }] })
      .expect(200);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-proj-test-key-0000');
    const sent = JSON.parse(init.body);
    expect(sent.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'project_plan', strict: true },
    });
    expect(sent.response_format.json_schema.schema.$schema).toBeUndefined();
    const prompt = sent.messages[1].content as string;
    expect(prompt).toContain('an intense pace');
    expect(prompt).toContain('15 minutes or less');
    expect(prompt).toContain('Keep most of the work with the person');
    expect(prompt).toContain('- Your level? Beginner');

    expect(body.tasks.map((task: { title: string }) => task.title)).toEqual([
      'Pick a course',
      'List 100 common words',
      'Practice greetings',
      'Brainstorm topics',
      'Book a tutor',
    ]);
    expect(body.tasks[0]).toMatchObject({ doer: 'human', prompt: null, skill: null, dueDate: day(0) });
    expect(body.tasks[0].steps).toHaveLength(8);
    expect(body.tasks[1]).toMatchObject({ doer: 'ai', steps: [], skill: null, dueDate: null });
    expect(body.tasks[2].dueDate).toBe(day(1));
    expect(body.tasks[3]).toMatchObject({ doer: 'skill', skill: '/brainstorming', dueDate: null });
    expect(body.tasks[4].dueDate).toBe(day(2));
  });

  it('spaces deadlines by the pace', async () => {
    const { agent, id } = await signUp();
    await saveApiKey(id, 'xai', 'xai-test-key-0000');
    await agent
      .patch('/api/me')
      .send({ preferences: { motivation: { pace: 'relaxed', taskSize: 'small', aiShare: 'max' } } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(openAiAnswer(JSON.stringify(PLAN))));
    const { body } = await agent
      .post('/api/planner/plan')
      .send({ ...IDEA, answers: [] })
      .expect(200);
    const dates = body.tasks
      .filter((task: { doer: string }) => task.doer === 'human')
      .map((task: { dueDate: string }) => task.dueDate);
    expect(dates).toEqual([day(0), day(7), day(14)]);
  });

  it('reports bad answers, rejected keys and timeouts clearly', async () => {
    const { agent, id } = await signUp();
    await saveApiKey(id, 'openai', 'sk-proj-test-key-0000');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(openAiAnswer('not json')));
    expect((await agent.post('/api/planner/questions').send(IDEA).expect(502)).body.error).toBe(
      'ChatGPT answered in an unexpected format. Try again.',
    );
    await pool.query('DELETE FROM user_api_keys');
    await saveApiKey(id, 'google', 'AIza-test-key-0000');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(403, { error: { status: 'PERMISSION_DENIED' } })));
    expect((await agent.post('/api/planner/questions').send(IDEA).expect(400)).body.error).toBe(
      'Your Gemini key was rejected — update it in Settings → AI',
    );
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('slow', 'TimeoutError')));
    await agent.post('/api/planner/questions').send(IDEA).expect(504);
  });

  it('reads Gemini answers', async () => {
    const { agent, id } = await signUp();
    await saveApiKey(id, 'google', 'AIza-test-key-0000');
    const fetchMock = vi.fn().mockResolvedValue(
      json(200, {
        candidates: [
          {
            content: {
              parts: [{ text: '{"questions":[{"question":"Budget?",' }, { text: '"choices":["Low"]}]}' }],
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { body } = await agent.post('/api/planner/questions').send(IDEA).expect(200);
    expect(body.questions).toEqual([{ question: 'Budget?', choices: ['Low'] }]);
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(sent.generationConfig.responseMimeType).toBe('application/json');
    expect(sent.systemInstruction.parts[0].text).toContain('planning coach');
  });
});

describe('committing a plan', () => {
  const hire = async (owner: Agent) => {
    await connect(owner);
    const [grant] = (await owner.get('/api/me/connections')).body.apps;
    const { body } = await owner
      .post('/api/me/agents')
      .send({ grantId: grant.id, name: 'Planner bot' })
      .expect(201);
    return body.workers[0].id as string;
  };

  const tasks = [
    {
      title: 'Pick a course',
      doer: 'human',
      summary: 'Choose one.',
      steps: ['Compare three', 'Pay'],
      skill: null,
      prompt: null,
      dueDate: day(0),
    },
    {
      title: 'List words',
      doer: 'ai',
      summary: 'Word list.',
      steps: [],
      skill: null,
      prompt: 'Write the words.\nAdd translations.',
      dueDate: null,
    },
    {
      title: 'Brainstorm',
      doer: 'skill',
      summary: 'Topics.',
      steps: [],
      skill: '/brainstorming',
      prompt: 'Find topics.',
      dueDate: null,
    },
  ];

  it('creates the tasks, adds the worker and gives it the AI work', async () => {
    const owner = agentFor();
    const { user } = await registerUser(owner);
    const project = await createProject(owner, { key: 'ESP', name: 'Spanish', module: 'personal' });
    const workerId = await hire(owner);
    const { body } = await owner
      .post(`/api/projects/${project.key}/plan`)
      .send({ tasks, agentId: workerId })
      .expect(201);
    expect(body).toMatchObject({ created: 3 });

    const list = (await owner.get(`/api/projects/${project.key}/tasks`).query({ sort: 'number', dir: 'asc' }))
      .body.items as {
      id: string;
      title: string;
      type: string;
      assignee: { id: string } | null;
      labels: { name: string }[];
      dueDate: string | null;
      checklistTotal: number;
      statusCategory: string;
    }[];
    expect(new Set(list.map((task) => task.statusCategory))).toEqual(new Set(['todo']));
    expect(
      list.map((task) => [
        task.title,
        task.type,
        task.assignee?.id,
        task.labels.map((label) => label.name),
        task.dueDate,
        task.checklistTotal,
      ]),
    ).toEqual([
      ['Pick a course', 'task', user.id, [], day(0), 2],
      ['List words', 'task', workerId, ['AI'], null, 0],
      ['Brainstorm', 'task', workerId, ['Skill'], null, 0],
    ]);
    const human = (await owner.get(`/api/tasks/${list[0]!.id}`)).body.task;
    expect(human.description).toContain('**When:** by');
    const ai = (await owner.get(`/api/tasks/${list[1]!.id}`)).body.task;
    expect(ai.description).toContain('> Write the words.\n> Add translations.');
    const skill = (await owner.get(`/api/tasks/${list[2]!.id}`)).body.task;
    expect(skill.description).toContain('**Skill to run:** `/brainstorming`');
    const members = (await owner.get(`/api/projects/${project.key}/members`)).body.members;
    expect(members).toContainEqual(
      expect.objectContaining({ id: workerId, isAgent: true, roleName: 'Member' }),
    );
  });

  it('makes human tasks chores in a household and needs task.create', async () => {
    const { owner, project, viewer } = await setupTeam();
    await owner
      .post(`/api/projects/${project.key}/plan`)
      .send({ tasks: [tasks[0]], agentId: null })
      .expect(201);
    await viewer.agent
      .post(`/api/projects/${project.key}/plan`)
      .send({ tasks: [tasks[0]], agentId: null })
      .expect(403);
    await owner.post(`/api/projects/${project.key}/plan`).send({ tasks: [], agentId: null }).expect(400);
    await owner.post('/api/shop/subscribe').send({ tier: 'personal' }).expect(201);
    const home = await createProject(owner, { key: 'HOME', name: 'Home', module: 'household' });
    await owner
      .post(`/api/projects/${home.key}/plan`)
      .send({ tasks: [tasks[0]], agentId: null })
      .expect(201);
    const [chore] = (await owner.get(`/api/projects/${home.key}/tasks`)).body.items;
    expect(chore.type).toBe('chore');
  });
});
