# Priority Schedule (BUGTRK-3) and AI Agent Guides (BUGTRK-5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a task with a due date move from a start priority to an end priority on its own, and show step-by-step connection instructions for every common AI agent, not only Claude and ChatGPT.

**Architecture:** BUGTRK-3 stores the schedule on the task (`escalate_from`, `escalate_to`, `escalate_since`) and keeps the real `priority` column up to date with one set-based SQL statement. The statement runs hourly in the background and immediately after any write that touches a scheduled task, so sorting, filters, boards, export and MCP keep reading `priority` unchanged. BUGTRK-5 moves the per-agent steps into one data module that a reusable `CodeBlock` renders. It also lets the OAuth server accept an app's own URL scheme for redirects, because Cursor signs in through `cursor://anysphere.cursor-mcp/oauth/callback`, which the server rejects today.

**Tech Stack:** pnpm monorepo · Express 5 + raw `pg` SQL on PostgreSQL 16 · React 19 + TanStack Query + Tailwind v4 · zod in `shared/` · Vitest + supertest

**Spec:** MSR cards [BUGTRK-3](https://msr-bug-tracker.onrender.com/t/BUGTRK-3) and [BUGTRK-5](https://msr-bug-tracker.onrender.com/t/BUGTRK-5), plus these decisions made with Michael on 2026-10-26:
- Gradual steps: every level between start and end gets an equal share of the window, from the start date (or the day the schedule was set) to the due date. The task holds the end priority on and after the due date.
- A manual priority change (picker, bulk edit, MCP) turns the schedule off.
- Agent guides cover Claude, ChatGPT, Claude Code, Cursor, VS Code, Codex CLI, Gemini CLI and any other MCP client.

## Global Constraints

- File layout: one component per file; inside a file, consts at the top, then functions, then hooks, then the return. Same order as `TaskProperties.tsx`.
- No unnecessary imports, consts or comments. Match the surrounding naming: `snake_case` columns and `camelCase` API fields.
- Backend: the most efficient approach. One set-based SQL statement per job, no per-row loops, and a partial index for the background scan.
- Priority levels ascend `low < medium < high < urgent`. Do not reuse the DB enum order, which is `urgent, high, medium, low`.
- A schedule always needs a due date. The DB enforces it with a `CHECK`. The API answers `400 Set a due date to schedule the priority`.
- Automatic changes are logged as `task_activity` rows with `action = 'escalated'`, `field = 'priority'` and `actor_id = NULL`.
- Allowed OAuth redirect URIs: `https:`, `http:` on loopback, or an app scheme. Never `javascript: data: vbscript: file: blob: about: filesystem: ws: wss: ftp:`, and never `http:` to a non-loopback host.

## Review Focus

- **Old task, no start date:** setting a schedule on a task created weeks ago must start the schedule at **Low today**, not jump straight to a late step. Fix: `escalate_since` holds the day the schedule was set. Test in Task 2.
- **Window shorter than the number of levels:** due tomorrow with Low → Urgent, or start = due. It must reach Urgent on the due date with no division by zero. Tests in Tasks 1 and 2.
- **Due date already past:** setting a schedule must apply the end priority immediately. Test in Task 2.
- **Completed and reopened tasks:** the job must not touch done tasks, and reopening must recompute right away. Test in Task 2.
- **Custom-scheme redirect:** `cursor://…` must register, `javascript:alert(1)` must get 400, and the consent page must show a readable destination (`cursor://anysphere.cursor-mcp`) instead of an empty host. Test in Task 5.

---

## BUGTRK-3: Priority schedule

Move BUGTRK-3 to **In Progress** before Task 1 and to **In Review** after Task 4 is pushed.

### Task 1: Shared schedule model

**Files:**
- Create: `shared/src/escalation.ts`
- Modify: `shared/src/types.ts` (`TaskCard`), `shared/src/schemas/task.ts`
- Test: `shared/test/escalation.test.ts`

**Interfaces:**
- Produces:
  - `interface EscalationRange { from: Priority; to: Priority }`
  - `interface TaskEscalation extends EscalationRange { since: string }`
  - `TaskCard.escalation: TaskEscalation | null`
  - `escalationSchema` (zod, from ≠ to). `taskFields.escalation = escalationSchema.nullable()`. `createTaskSchema` refines that `escalation` needs `dueDate` (path `['escalation']`).
  - `PRIORITY_LEVELS = ['low', 'medium', 'high', 'urgent']`
  - `escalationSteps(range: EscalationRange, firstDay: string, dueDate: string): { priority: Priority; from: string }[]`
  - `escalatedPriority(range, firstDay, dueDate, today: string): Priority`
  - `describeEscalation(range: EscalationRange | null): string | null` → `'Low → Urgent'`

**Formula.** The SQL in Task 2 must produce the same result:
`start = min(firstDay, dueDate)`, `D = dueDate − start` in days, `n = |to − from| + 1`. Step `k ≥ 1` begins on day `start + ceil(k·D/n)`, or on `start` when `D = 0`. When several steps begin on the same day, keep only the last. `escalatedPriority` returns the last step whose `from ≤ today`, or the first step if none has begun.

- [ ] **Step 1: Write the failing tests**

```ts
expect(escalationSteps({ from: 'low', to: 'urgent' }, '2026-11-01', '2026-11-10')).toEqual([
  { priority: 'low', from: '2026-11-01' },
  { priority: 'medium', from: '2026-11-04' },
  { priority: 'high', from: '2026-11-06' },
  { priority: 'urgent', from: '2026-11-08' },
]);
expect(escalationSteps({ from: 'urgent', to: 'low' }, '2026-11-01', '2026-11-10').map((s) => s.priority))
  .toEqual(['urgent', 'high', 'medium', 'low']);
expect(escalationSteps({ from: 'low', to: 'urgent' }, '2026-11-02', '2026-11-02')).toEqual([{ priority: 'urgent', from: '2026-11-02' }]);
expect(escalationSteps({ from: 'low', to: 'urgent' }, '2026-11-01', '2026-11-02')).toEqual([
  { priority: 'low', from: '2026-11-01' },
  { priority: 'urgent', from: '2026-11-02' },
]);
expect(escalationSteps({ from: 'low', to: 'high' }, '2026-11-20', '2026-11-10')).toEqual([{ priority: 'high', from: '2026-11-10' }]);
const range = { from: 'low', to: 'urgent' } as const;
expect(escalatedPriority(range, '2026-11-01', '2026-11-10', '2026-10-30')).toBe('low');
expect(escalatedPriority(range, '2026-11-01', '2026-11-10', '2026-11-05')).toBe('medium');
expect(escalatedPriority(range, '2026-11-01', '2026-11-10', '2026-11-10')).toBe('urgent');
expect(escalatedPriority(range, '2026-11-01', '2026-11-10', '2026-12-01')).toBe('urgent');
expect(describeEscalation(range)).toBe('Low → Urgent');
expect(createTaskSchema.safeParse({ title: 'x', escalation: range }).success).toBe(false);
expect(updateTaskSchema.safeParse({ escalation: { from: 'low', to: 'low' } }).success).toBe(false);
```

- [ ] **Step 2: Run** `pnpm --filter ./shared test`. Expected: FAIL, because the module isn't found.
- [ ] **Step 3: Implement** `shared/src/escalation.ts`, then the type and schema changes. Do the day math with `Date.parse` on UTC dates (`'YYYY-MM-DD'`) divided by `86_400_000`.
- [ ] **Step 4: Run** `pnpm --filter ./shared test`. Expected: PASS.
- [ ] **Step 5: Commit** with message `Share the priority schedule model, its steps and validation`.

### Task 2: Store, compute and maintain the schedule on the server

**Files:**
- Create: `server/src/db/migrations/013_priority_schedule.sql`, `server/src/modules/tasks/escalation.ts`
- Modify: `server/src/modules/tasks/service.ts` (create, update, bulk, duplicate, recurrence spawn), `server/src/modules/tasks/queries.ts` (card columns plus `toCard`), `server/src/index.ts` (hourly job)
- Test: `server/test/escalation.test.ts`

**Interfaces:**
- Consumes: Task 1 types and `describeEscalation`. The tests use `escalatedPriority` for the parity check.
- Produces: `escalatePriorities(taskIds: string[] | null, log: boolean, db?: Db): Promise<void>`. `null` means all scheduled open tasks. `log = false` skips the activity rows, which is used on create and spawn.

**Migration:**
```sql
ALTER TABLE tasks
  ADD COLUMN escalate_from task_priority,
  ADD COLUMN escalate_to task_priority,
  ADD COLUMN escalate_since date,
  ADD CONSTRAINT tasks_escalation_complete CHECK (
    (escalate_from IS NULL) = (escalate_to IS NULL) AND (escalate_from IS NULL) = (escalate_since IS NULL)
    AND (escalate_from IS NULL OR escalate_from <> escalate_to)),
  ADD CONSTRAINT tasks_escalation_due CHECK (escalate_from IS NULL OR due_date IS NOT NULL);
CREATE INDEX tasks_escalating_idx ON tasks (id) WHERE escalate_from IS NOT NULL AND completed_at IS NULL;
```

**Job SQL.** This is one statement. `today` is the assignee's timezone, then the reporter's, then UTC.

```sql
WITH target AS (
  SELECT t.id, t.project_id, t.priority AS old_priority, (LEVELS)[w.lo + sign(w.hi - w.lo)::int * CASE
           WHEN w.today >= t.due_date THEN abs(w.hi - w.lo)
           WHEN w.today <= w.first_day THEN 0
           ELSE least(abs(w.hi - w.lo), (w.today - w.first_day) * (abs(w.hi - w.lo) + 1) / (t.due_date - w.first_day))
         END + 1] AS new_priority
  FROM tasks t
  LEFT JOIN users a ON a.id = t.assignee_id
  LEFT JOIN users r ON r.id = t.reporter_id
  CROSS JOIN LATERAL (SELECT
    (now() AT TIME ZONE coalesce(a.preferences->>'timezone', r.preferences->>'timezone', 'UTC'))::date AS today,
    least(coalesce(t.start_date, t.escalate_since), t.due_date) AS first_day,
    array_position(LEVELS, t.escalate_from) - 1 AS lo, array_position(LEVELS, t.escalate_to) - 1 AS hi) w
  WHERE t.escalate_from IS NOT NULL AND t.completed_at IS NULL AND ($1::uuid[] IS NULL OR t.id = ANY($1))
), changed AS (
  UPDATE tasks t SET priority = target.new_priority, updated_at = now()
  FROM target WHERE t.id = target.id AND t.priority <> target.new_priority
  RETURNING t.id, t.project_id, target.old_priority, target.new_priority
)
INSERT INTO task_activity (project_id, task_id, action, field, old_value, new_value)
SELECT project_id, id, 'escalated', 'priority', to_jsonb(old_priority), to_jsonb(new_priority) FROM changed WHERE $2
```
`LEVELS` = `ARRAY['low','medium','high','urgent']::task_priority[]`.

**Service rules:**
- `createTask`: insert `escalate_from/to/since`, where `since` is the actor's today (`ACTOR_TODAY`). If a schedule is set, run `escalatePriorities([id], false, db)`.
- `updateTask`: after the dates are resolved, compute `next`:
  - `patch.escalation` when it is given.
  - Otherwise `null` if `priority` changed while a schedule was on.
  - Otherwise `null` if the resulting due date is `null`.
  - Otherwise the current schedule.
  
  If `patch.escalation` is non-null and there's no due date, throw 400. When `next` differs from the current schedule, set the three columns (`since` = actor's today; `null` when turned off) and `log('escalation', describe(old), describe(next))`. After the UPDATE, if `next` is set, run `escalatePriorities([taskId], true, db)`.
- `bulkUpdateTasks`: a priority patch also clears the schedule on the changed rows that had one and logs `escalation → null`. A status change runs `escalatePriorities(ids, true, db)` so reopened tasks are recomputed.
- `DUPLICATE_TASK` copies the three columns. `SPAWN_RECURRENCES` copies `escalate_from/to`, sets `escalate_since` to today, then runs `escalatePriorities(createdIds, false, db)`.
- `index.ts`: run `escalatePriorities(null, true)` at boot and every `HOUR`, logging `'Priority schedule failed'` on error.

- [ ] **Step 1: Write the failing tests.** Dates are relative to UTC today through `day(offset)`.
  - `starts on the day the schedule is set`: backdate `created_at` by 30 days, PATCH `{ escalation: {from:'low',to:'urgent'} }` with due `day(9)` → `priority 'low'`, `escalation { from:'low', to:'urgent', since: day(0) }`.
  - `picks the current step from the start date`: start `day(-5)`, due `day(4)`, low→urgent → `'high'`.
  - `jumps to the end priority when the due date has passed`: due `day(-1)`, low→high → `'high'`.
  - `reaches the end priority on a one-day window`: start `day(0)`, due `day(0)` → `'urgent'`.
  - `raises the priority as days pass and logs it`: SQL-shift the dates to start `day(-7)` and due `day(2)`, run `escalatePriorities(null, true)` → `'urgent'`. The last activity is `{ action:'escalated', field:'priority', oldValue:'low', newValue:'urgent' }` with no actor.
  - `a manual priority change turns the schedule off` (single PATCH and bulk) → `escalation null`, and a later job run keeps the manual value.
  - `needs a due date`: POST with a schedule and no due date → 400. PATCH `dueDate: null` → `escalation null`.
  - `leaves done tasks alone and recomputes on reopen`.
  - `recurring copies restart the schedule`: the spawned task has the same range and `since = day(0)`, and its priority equals `escalatedPriority(range, spawned.startDate ?? since, spawned.dueDate, day(0))`.
  - `matches the shared formula`: for windows `(start, due)` ∈ `{(0,0),(0,1),(-1,1),(-3,9),(-9,9),(-20,3)}` × ranges `{low→urgent, urgent→low, medium→high}`, compare the API priority to `escalatedPriority`.
- [ ] **Step 2: Run** `pnpm --filter ./server exec vitest run test/escalation.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration, `escalation.ts`, the service changes, the queries and `index.ts`.
- [ ] **Step 4: Run** the new file, then the whole `pnpm --filter ./server test`. Expected: all PASS (161 + new).
- [ ] **Step 5: Commit** with message `Move a task's priority from start to end as its due date nears`.

### Task 3: MCP connector support

**Files:** Modify `server/src/modules/connector/tools/tasks.ts`, `server/src/modules/connector/format.ts`. Test: `server/test/connector.test.ts`.

**Interfaces:** Both `create_task` and `update_task` take `escalation: { from, to }`. It is `.nullable()` on update, and its description is *"Move the priority step by step from `from` to `to` by the due date; needs a due date. null turns it off."* `compactTask` adds `escalation: 'low → urgent'` when the schedule is set.

- [ ] **Step 1: Failing test.** `update_task` with `{ id, dueDate: day(9), escalation: { from: 'low', to: 'urgent' } }` → `task.escalation === 'low → urgent'` and `task.priority === 'low'`.
- [ ] **Step 2: Run** it and expect FAIL. **Step 3:** implement. **Step 4:** run it and expect PASS. **Step 5: Commit** with message `Let AI connectors set a priority schedule`.

### Task 4: Priority schedule UI

**Files:**
- Create: `client/src/features/tasks/components/EscalationPicker.tsx`, `client/src/features/tasks/__tests__/activityText.test.ts`
- Modify: `client/src/features/tasks/detail/TaskProperties.tsx` (an "Escalate" row under Due date, shown only when `task.dueDate`), `client/src/features/tasks/components/TaskPropertyPicker.tsx` (`TrendingUp` mark beside the priority when scheduled; the optimistic priority patch and due-date clear add `escalation: null`), `client/src/features/tasks/components/TaskCardView.tsx` (the same mark on the priority badge), `client/src/features/tasks/activityText.ts` (`escalation: 'priority schedule'`, plus `escalated` → `raised|lowered the priority from X to Y`), `client/src/features/tasks/components/ActivityItem.tsx` (an `escalated` row with no actor shows "Priority schedule")

**Interfaces:**
```ts
interface EscalationPickerProps {
  value: TaskEscalation | null;
  onChange: (value: EscalationRange | null) => void;
  startDate: string | null;
  dueDate: string;
  disabled?: boolean;
  placeholder?: string;
  renderTrigger?: (value: TaskEscalation | null) => ReactNode;
  className?: string;
  'aria-label'?: string;
}
```
The popover has two `SegmentedControl`s (From, To) built from `PRIORITY_LEVELS` with `PriorityIcon`, and a step preview from `escalationSteps(draft, startDate ?? (unchanged ? value.since : todayIso()), dueDate)`. Buttons: Turn off (only when `value`), Cancel, and Save (disabled when from = to). Trigger text: `describeEscalation(value) ?? placeholder` (default `"Doesn't change"`).

- [ ] **Step 1: Failing test.** `activityText({ action: 'escalated', field: 'priority', oldValue: 'low', newValue: 'high', … })` → `'raised the priority from low to high'`. The reverse gives `'lowered …'`. `{ action: 'updated', field: 'escalation', oldValue: null, newValue: 'Low → Urgent' }` → `'changed priority schedule from none to Low → Urgent'`.
- [ ] **Step 2: Run** `pnpm --filter ./client test` and expect FAIL. **Step 3:** implement. **Step 4:** run `pnpm --filter ./client test && pnpm typecheck && pnpm lint` and expect PASS.
- [ ] **Step 5: Check in the browser** at desktop width and at 390 px: set a schedule, see the steps, change the priority by hand and see the schedule turn off.
- [ ] **Step 6: Commit** with message `Pick a start and end priority for tasks with a due date`. Push, then move BUGTRK-3 to **In Review**.

---

## BUGTRK-5: Connect any AI agent

Move BUGTRK-5 to **In Progress** before Task 5 and to **In Review** after Task 6 is pushed.

### Task 5: Accept app-scheme OAuth redirects

**Files:** Modify `server/src/modules/connector/oauth.ts` and `server/src/modules/connector/service.ts`. Test: `server/test/connector.test.ts`.

**Interfaces:**
- `isSafeRedirect(uri)` accepts `https:`, loopback `http:`, or any scheme outside `BLOCKED_SCHEMES` other than `http:`. The error becomes `'Redirect URIs must use https, http on localhost, or an app scheme'`.
- `redirectLabel(url: URL): string`: `url.host` for http(s), otherwise `` `${url.protocol}//${url.host}` `` (or just `url.protocol` when there is no host). `previewRequest.redirectHost` and `listConnectedApps.host` both use it.
- "Start connecting again from Claude or ChatGPT." becomes "Start connecting again from your AI app."

- [ ] **Step 1: Extend the failing test** `refuses redirect URIs that are not https, loopback or an app scheme`:
  - `cursor://anysphere.cursor-mcp/oauth/callback` → 201
  - `javascript:alert(1)` → 400
  - `data:text/html,x` → 400
  - `http://evil.example/cb` → 400
  - A preview for the cursor client shows `redirectHost === 'cursor://anysphere.cursor-mcp'`.
- [ ] **Step 2: Run** it and expect FAIL. **Step 3:** implement. **Step 4:** run `pnpm --filter ./server test` and expect PASS. **Step 5: Commit** with message `Let desktop apps such as Cursor sign in to the connector`.

### Task 6: Agent guides in Settings → Connected apps

**Files:**
- Create: `client/src/components/ui/CodeBlock.tsx`, `client/src/features/connector/agentGuides.tsx`, `client/src/features/connector/__tests__/agentGuides.test.tsx`
- Modify: `client/src/features/settings/pages/ConnectedAppsSettings.tsx`, `README.md` (the AI connector bullet)

**Interfaces:**
- `CodeBlock({ code: string; copyLabel: string; title?: string; wrap?: boolean; className?: string })` renders a `<pre>` with a copy `IconButton` (`copyText(code, copyLabel)`). `wrap` switches `whitespace-pre overflow-x-auto` to `whitespace-pre-wrap break-all`. It replaces the URL box.
- `type AgentId = 'claude' | 'chatgpt' | 'claude-code' | 'cursor' | 'vscode' | 'codex' | 'gemini' | 'other'`
- `interface AgentGuide { id: AgentId; label: string; group: 'Chat apps' | 'Coding agents'; steps: (url: string) => Step[] }` and `AGENT_GUIDES: AgentGuide[]`.
- The page picks a guide with `OptionPicker` (options grouped by `group`) in place of `SegmentedControl`.

**Guide content.** Use `msr-tracker` as the server name everywhere.
- Claude and ChatGPT: the current steps, unchanged.
- Claude Code: `claude mcp add --transport http --scope user msr-tracker <url>`, then run `/mcp` in Claude Code, pick msr-tracker, choose Authenticate, then sign in and choose Allow.
- Cursor: Cursor Settings → Tools & MCP → New MCP Server, then `{"mcpServers":{"msr-tracker":{"url":"<url>"}}}` into `~/.cursor/mcp.json`, then Connect next to msr-tracker, sign in and Allow.
- VS Code: run *MCP: Open User Configuration*, add `{"servers":{"msr-tracker":{"type":"http","url":"<url>"}}}`, choose Start, sign in and Allow, then use it from Copilot Chat in Agent mode.
- Codex CLI: `codex mcp add msr-tracker --url <url>`, then `codex mcp login msr-tracker`.
- Gemini CLI: `gemini mcp add --transport http --scope user msr-tracker <url>`, then run `/mcp auth msr-tracker` inside Gemini CLI.
- Any other MCP client:
  - Add a remote (Streamable HTTP) server with the URL. Sign-in is OAuth 2.1 with discovery, dynamic client registration and PKCE.
  - Snippet: `{"mcpServers":{"msr-tracker":{"url":"<url>"}}}`.
  - Clients that only run local servers can use `{"mcpServers":{"msr-tracker":{"command":"npx","args":["-y","mcp-remote","<url>"]}}}`.

- [ ] **Step 1: Failing test.** Each `AGENT_GUIDES` id is unique, there are 8 of them, and `render(<StepList steps={guide.steps(URL)} />)` contains `URL` for every guide.
- [ ] **Step 2: Run** `pnpm --filter ./client test` and expect FAIL. **Step 3:** implement. **Step 4:** run `pnpm --filter ./client test && pnpm typecheck && pnpm lint` and expect PASS.
- [ ] **Step 5: Check in the browser** at 390 px: the picker opens as a sheet, snippets scroll rather than overflow the page, and copy works.
- [ ] **Step 6: Commit** with message `Show connection steps for Claude Code, Cursor, VS Code, Codex, Gemini and any MCP client`. Push, then move BUGTRK-5 to **In Review**.
