# Plans & Modules (BUGTRK-9, 16), AI Planning (BUGTRK-7), AI Worker (BUGTRK-17), Appointments (BUGTRK-15), Telegram Bot Module (BUGTRK-14)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

## Context

Michael wants the tracker to grow from "software + household" into **modules** that each drive their own AI prompts, sold through **yearly account plans** in a **Shop**. Everything is free during launch. Alongside that:

- A **new-idea flow** asks AI clarifying questions and breaks the idea into small, motivating tasks. A task goes to the human only when AI can't do it.
- **AI workers** are connected AI apps added to a project with a role and assigned tasks.
- **Household appointments** have a location, a time and a duration.
- A free **Telegram bot module** can be connected to any project. It answers commands, pushes the notifications each chat picks, and reminds people of appointments. Telegram was chosen over WhatsApp: WhatsApp's free Cloud API can't join family groups, and Telegram is free with native group support.

Decisions made with Michael on 2026-10-28:

- **Modules now:**
  - Implemented: Software (base), Personal project, Household, Skill development, Startup idea.
  - Shown as **Coming soon** in the Shop: Event, Home renovation, Job search, Trip, Fitness.
  - The **Telegram bot** is an add-on module.
- **Plans** are yearly account plans only, with no per-project purchase:

  | Plan     | Modules                                                                | Telegram bot            | New projects / year |
  | -------- | ---------------------------------------------------------------------- | ----------------------- | ------------------- |
  | Free     | Software, Personal                                                     | —                       | 3                   |
  | Personal | Software, Personal, Household, Skill, Fitness\*, Event\*, Job search\* | Household projects only | 150                 |
  | Pro      | All modules (adds Startup, Renovation\*, Trip\*)                       | Any project             | 350                 |

  \* Coming soon. These are not shown on plan cards in the Shop, only in the modules grid.

- **Project packs:** buy X new projects for one module, with ready-made **10** and **25** packs on sale, or any custom number from 1 to 100.
  - A pack works whatever your plan is: a Free user can buy 10 Startup projects.
  - Packs don't expire.
  - A pack never unlocks the bot, which stays plan-based.
  - Creating a project uses the yearly plan allowance first (when the plan includes the module), then the oldest pack for that module.
- **AI worker:** a connected app turned into a worker **signs in as the worker**. It sees only the projects it was added to and follows its role. To have the app act as you again, connect it a second time.
- **Appointments:** an appointment type for household-module calendar events, with location, start time, duration and reminders.
- **Bot notifications** are picked per linked chat:
  - task created
  - task assigned
  - status changed / done
  - comments
  - daily due digest
  - overdue alerts
  - priority raised
  - appointment reminders
  - shopping list changes
  - new events & appointments
- **Custom bot commands** come later, as an MSR task.

Defaults (no decision needed):

- A plan gates **creating** projects (module + yearly count) and the **bot**. The bot is checked against the project owner's current plan each time it's used.
- Members never need a plan.
- Existing projects keep working and get the module that matches their kind.
- The yearly count is new projects you created since your plan started. On Free it's the last 365 days. Deleting a project doesn't give the slot back.
- The AI planner and AI workers work on every plan; the planner uses your own AI key.

Copy this plan to `docs/superpowers/plans/2026-10-28-plans-modules-ai-worker-appointments-telegram.md` in the first commit, as with earlier plans.

## Global constraints

- Work on branch `minka/wonderful-planck-vw2has`. Commit per task and push at the end of each ticket.
- File layout: one component per file. Inside a file: consts, then functions, then hooks, then the return. Same order as `CreateProjectModal.tsx` and `TaskProperties.tsx`.
- No unnecessary imports, consts or comments. `snake_case` columns, `camelCase` API fields.
- Server modules use `routes.ts` (zod parse + permission checks) and `service.ts` (SQL consts at the top, then functions), as in `docs/server-architecture.md`.
- Backend favors the most efficient approach: set-based SQL, single-statement claims (`UPDATE … RETURNING`, `DELETE … RETURNING`), `unnest` bulk inserts, no per-row loops.
- Before any Claude API code, re-read the `claude-api` skill's TS `tool-use.md` structured-outputs section.
- Move each MSR ticket to **In Progress** before its first task and to **In Review** after its last push.

---

## BUGTRK-9: Modules and plans

### Task 1: Shared catalog and plans

**Create** `shared/src/modules.ts`. **Modify** `shared/src/enums.ts`, `shared/src/types.ts` (`ProjectSummary.module`, `PlanStatus`) and `shared/src/schemas/project.ts`. **Test:** `shared/test/modules.test.ts`.

- `PROJECT_MODULES = ['software','personal','household','skill','startup']`. This is the DB enum, available now.
- `COMING_SOON_MODULES = ['event','renovation','job_search','trip','fitness']`. Shop display only.
- `PLAN_TIERS = ['free','personal','pro']`.
- `MODULE_META: Record<ProjectModule | ComingSoonModule, { label; description; icon; kind: ProjectKind; taskTypes: readonly TaskType[]; labels: string[]; features: string[]; available: boolean }>`:
  - software: types task/bug/feature/improvement.
  - household: kind household, types chore/errand/task, `HOUSEHOLD_LABELS`.
  - startup: software types.
  - personal and skill: types task/errand, each with 4–5 starter labels. For example skill: Practice, Theory, Project, Review.
- `BOT_META`: label "Telegram bot", description and features.
- `PLAN_META: Record<PlanTier, { label; description; modules: readonly (ProjectModule|ComingSoonModule)[]; bot: 'none'|'household'|'all'; projectsPerYear: 3|150|350; priceCents: 0 }>`.
- `PACK_PRESETS = [10, 25]`, `PACK_MAX = 100` and `packSchema { module: z.enum(PROJECT_MODULES), projects: z.int().min(1).max(PACK_MAX) }`.
- `planAllows(tier, module)` and `botAllowed(tier, module)`. The latter is `bot === 'all' || (bot === 'household' && module === 'household')`.
- `minimumPlan(module)`, for "Upgrade to Personal" copy.
- Replace `KIND_TASK_TYPES[kind]` with `MODULE_META[module].taskTypes` in all 6 client uses (`useTaskOptions`, `QuickCreateTaskModal`, `groupTasks`, `TaskBoardView` via `typesFor(module, workflow)`, `ProjectOverviewPage`). Delete `KIND_TASK_TYPES` and `PROJECT_KIND_META`.
- `createProjectSchema`: `kind` becomes `module: z.enum(PROJECT_MODULES).default('software')`.
- Tests:
  - Every tier's modules are known ids.
  - Free ⊂ Personal ⊂ Pro.
  - `botAllowed('personal','software')` is false, `botAllowed('personal','household')` is true, and `botAllowed('pro','software')` is true.
  - `typesFor('personal','bug')` is empty.

### Task 2: Store modules and plans; gate project creation

**Create** `server/src/db/migrations/014_plans_modules.sql` and `server/src/modules/shop/{routes.ts,service.ts}`. **Modify** `server/src/modules/projects/{service.ts,routes.ts}`, `server/src/app.ts`, `server/src/middleware/rateLimits.ts`, and `server/test/helpers.ts` plus the 2 tests that pass `kind: 'household'` (they subscribe to Personal first). **Test:** `server/test/plans.test.ts`.

```sql
CREATE TYPE project_module AS ENUM ('software','personal','household','skill','startup');
CREATE TYPE plan_tier AS ENUM ('personal','pro');
ALTER TABLE projects ADD COLUMN module project_module NOT NULL DEFAULT 'software';
UPDATE projects SET module = 'household' WHERE kind = 'household';
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier plan_tier NOT NULL,
  price_cents int NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX subscriptions_user_idx ON subscriptions (user_id, expires_at DESC);
CREATE TABLE module_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module project_module NOT NULL,
  projects int NOT NULL CHECK (projects BETWEEN 1 AND 100),
  projects_used int NOT NULL DEFAULT 0 CHECK (projects_used <= projects),
  price_cents int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX module_packs_open_idx ON module_packs (user_id, module, created_at) WHERE projects_used < projects;
CREATE TABLE project_creations (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  pack_id uuid REFERENCES module_packs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX project_creations_plan_idx ON project_creations (user_id, created_at) WHERE pack_id IS NULL;
```

- `CURRENT_PLAN`:

  ```sql
  SELECT tier, starts_at, expires_at FROM subscriptions
  WHERE user_id = $1 AND expires_at > now() ORDER BY tier DESC, expires_at DESC LIMIT 1
  ```

  No row means Free, with the period starting `now() - 1 year`.

- `createProject`, all in its existing transaction:
  1. `SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, which serializes one user's creates.
  2. Load the plan and its period. When `planAllows`, count `project_creations WHERE user_id = $1 AND pack_id IS NULL AND created_at >= period_start`. Under `projectsPerYear` → use the plan.
  3. Otherwise consume a pack in one statement:

     ```sql
     UPDATE module_packs SET projects_used = projects_used + 1
     WHERE id = (SELECT id FROM module_packs
                 WHERE user_id = $1 AND module = $2 AND projects_used < projects
                 ORDER BY created_at LIMIT 1)
     RETURNING id
     ```

     No pack left gives one of two errors:
     - The plan doesn't include the module → `402 Upgrade to <Plan> or buy <Module> projects to start one`.
     - The plan's yearly allowance is used up → `402 Your <Plan> plan allows <N> new projects a year — buy a <Module> pack for more`.

  4. Insert the project. `kind = MODULE_META[module].kind`. Seed the module's labels. Household keeps its Groceries list.
  5. Insert the `project_creations` row, with `pack_id` when a pack was used.

  The demo generator bypasses this, so demo projects don't count.

- `SUMMARY_SQL` and `toSummary` add `module`.
- Shop routes under `/api/shop`, rate-limited:
  - `GET /` → `{ plan: { tier, startsAt, expiresAt, projectsUsed, projectsLimit }, packs: { module, projectsLeft }[] }`. Packs are summed per module in one `GROUP BY` over open packs.
  - `POST /subscribe {tier}`: free during launch, so `price_cents = 0` and `expires_at = now() + 1 year`. The same or a higher active tier → 409 `You already have <Plan>`. Personal → Pro is an upgrade: a new row, and the period restarts.
  - `POST /packs {module, projects}` (`packSchema`) → 201, with `price_cents = 0` during launch.
- Tests:
  - Free: software and personal OK; household → 402; the 4th project within a year → 402; a 13-month-old creation row doesn't count (backdated by SQL); deleting a project doesn't free its slot.
  - Personal: household and skill OK; startup → 402.
  - Pro: startup OK.
  - Limits: lower `projectsPerYear` through an injectable test override, or insert ledger rows by SQL, and check 402 at the limit.
  - Packs:
    - A Free user buys 10 Startup → can create Startup. The pack shows 9 left, and the plan's yearly count is unchanged.
    - A used-up pack → 402.
    - A plan-allowed module uses the yearly allowance first, then the pack once the allowance is used up.
    - `projects: 0` or `101` → 400.
  - Concurrency: 3 parallel creates with 1 slot left → exactly one 201, for both the plan allowance and a 1-project pack.
  - An expired subscription falls back to Free.
  - A member without any plan can use a household's lists.
  - Existing household projects are backfilled to module household (migration test).
- Commit: `Sell yearly plans and module project packs and check them when starting a project`.

### Task 3: Module-aware UI basics

**Modify:**

- `ProjectLayout.tsx`: show the Bugs tab only when the module's task types include `bug`.
- `ProjectCard.tsx`: a module badge.
- `CreateProjectModal.tsx`: a module `ChoiceGroup` replaces the kind picker.
  - A module the plan doesn't include and with no pack left shows a lock, "Personal" or "Pro", and an **Upgrade or buy projects** Shop link.
  - A module with a pack shows "7 left".
  - Coming-soon modules aren't offered.
  - Usage shows as "2 of 3 new projects this year".
- `features/projects/api.ts`.

Commit: `Pick a module when creating a project`.

## BUGTRK-16: Shop page

### Task 4: Shop page

**Create:**

- `client/src/features/shop/api.ts`: `usePlan`, `useSubscribe`, `useBuyPack`.
- `client/src/features/shop/components/PackPicker.tsx`: `{ module, presets = PACK_PRESETS, max = PACK_MAX, onBuy(projects), pending, className }`. It shows a "10 projects · Sale" and a "25 projects · Sale" option, plus a custom number input (1–100) with **Get**.
- `client/src/features/shop/pages/ShopPage.tsx`.
- `client/src/features/shop/components/PlanCard.tsx`: `{ tier, current, onSelect, pending, className, footer }`.
- `client/src/features/shop/components/ModuleCard.tsx`: `{ title, description, icon, features, badges, status: 'included'|'locked'|'coming_soon', action, className }`. It is reused for the Telegram bot card.
- `client/src/features/shop/components/PlanUsage.tsx`: "3 of 150 new projects · renews Oct 28, 2027".

**Modify:** `client/src/app/router.tsx` (`/shop`), `client/src/components/layout/navItems.ts` (a "Shop" item with the `Store` icon), and `CreateProjectModal` (an `initialModule` prop for "Start a project").

- **Plans row:** Free / Personal / Pro cards. Each lists **only the implemented modules** it includes, plus the bot rule and the yearly project count. Each shows a ~~price~~ "Free during launch" badge, and "Current plan" or "Get Personal" / "Get Pro".
- **Modules grid:** the 5 available modules, Coming-soon cards for the other 5, and the Telegram bot card ("Personal: households · Pro: any project").
  - Each available card shows the plans that include it, its pack balance ("7 Startup projects left"), a `PackPicker`, and **Start a project** when it's included or has packs left.
  - Coming-soon cards have no buy options.
- At 390 px it's a single column with 44 px buttons.
- e2e `e2e/19-plans.spec.ts`:
  - A free user sees household locked in New project.
  - Shop → Get Personal → create a household. Startup is still locked.
  - Get Pro → create Startup, and the Bugs tab is present.
  - A Personal project has no Bugs tab.
  - Another free user buys the 10-project Startup pack → creates a Startup project → the card shows "9 left".
- Commit: `Add the Shop with plans and modules`. Push, then move BUGTRK-9 and BUGTRK-16 to **In Review**.

## BUGTRK-17: AI worker

### Task 5: AI worker identities on the server

**Create** `server/src/db/migrations/015_ai_workers.sql` and `server/src/modules/agents/{routes.ts,service.ts}`. **Modify:**

- `connector/oauth.ts` (`VERIFY_ACCESS` joins `users u ON u.id = coalesce(g.agent_id, g.user_id)`).
- `connector/service.ts` (`LIST_GRANTS` returns the worker's id and name).
- `connector/mcp.ts` (an instructions line: "If you are connected as an AI worker, my_tasks lists the work assigned to you").
- `members/{routes.ts,service.ts}`: `is_agent` in `MEMBER_SELECT`. Adding a member by email refuses agent users.
- `users/service.ts`: `agent_owner_id` in `USER_COLUMNS`.
- `shared/src/types.ts`: `ProjectMember.isAgent`, `AiWorker`, `ConnectedApp.worker`.
- `app.ts`.

**Test:** `server/test/agents.test.ts`.

```sql
ALTER TABLE users ADD COLUMN agent_owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX users_agent_owner_idx ON users (agent_owner_id) WHERE agent_owner_id IS NOT NULL;
ALTER TABLE oauth_grants ADD COLUMN agent_id uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE;
```

Deleting a worker cascades its connection, so a worker connection can never fall back to the owner's access.

- A worker is a `users` row:
  - `email = 'agent-<uuid>@agents.invalid'`, `password_hash NULL` (login already rejects null hashes).
  - `preferences` copies the owner's timezone, and `agent_owner_id = owner`.
- Routes:
  - `GET /api/me/agents`.
  - `POST /api/me/agents {grantId, name}`: the grant must be the caller's and unbound. Creates the user and sets `agent_id`, in one transaction.
  - `PATCH /api/me/agents/:id {name?, grantId?}`: rename, or rebind to another unbound grant.
  - `DELETE /api/me/agents/:id`.
  - `POST /api/projects/:key/members/agents {agentId, roleId}`: needs `project.manage_members` and that the caller owns the worker. Not the owner role, plus `assertCovers`.
- Tests:
  - Converting a grant makes its MCP token act as the worker. `list_projects` shows only projects the worker was added to.
  - `my_tasks` returns the worker's tasks.
  - A viewer-role worker gets a tool error on `update_task`.
  - Someone else's worker → 404.
  - Adding a worker by email → 404.
  - Deleting the worker removes the grant and unassigns its tasks.
  - Changing the owner's password removes the worker's grant.
- Commit: `Let a connected AI app work in projects as an AI worker with its own role`.

### Task 6: AI worker UI

**Create:**

- `client/src/features/agents/api.ts`.
- `client/src/features/agents/components/AiWorkerList.tsx`.
- `client/src/features/agents/components/CreateWorkerDialog.tsx`: warns that this connection will act as the worker.
- `client/src/features/agents/components/AddWorkerDialog.tsx`.

**Modify:**

- `ConnectedAppsSettings.tsx`: an "AI workers" section, a worker badge on app rows, and "Make it an AI worker".
- `MemberSettings.tsx`: "Add AI worker". With no workers, it links to Settings → Connected apps.
- `useTaskOptions.tsx` and the member rows: a `Bot` mark for `isAgent`.

Check in the browser at desktop width and 390 px. Commit: `Add AI workers to projects and assign them tasks`. Push, then move BUGTRK-17 to **In Review**.

## BUGTRK-7: AI plan for a new idea

### Task 7: AI client, motivation settings and planner API

**Create:**

- `server/src/lib/ai.ts`: `generateJson<T>({ provider, apiKey, system, prompt, schema: z.ZodType<T>, maxTokens })`.
  - Anthropic uses the SDK: `claude-opus-5-5`, structured output via `output_config.format` from the zod schema, `effort: 'medium'`, and `fallbacks: 'default'` with beta `server-side-fallback-2026-07-01` (the skill's default; tell Michael). Check `stop_reason === 'refusal'`.
  - OpenAI and xAI use `fetch` against chat-completions with `response_format: json_schema` (`z.toJSONSchema`).
  - Gemini uses `generateContent` with `responseJsonSchema`.
  - Model IDs are consts at the top. Verify the current OpenAI, Gemini and Grok IDs against each provider's models endpoint when implementing.
  - Output is parsed with the zod schema. Provider 401/403 → `400 Your <AI> key was rejected — update it in Settings → AI`. Timeout (90 s) → 504. Invalid JSON → 502.
- `aiKeys/service.ts` gets `openApiKey(userId)`. It picks `preferences.aiProvider`, else the first saved key, else throws `400 Add an AI key in Settings → AI`.
- `server/src/modules/planner/prompts.ts`: `BASE_RULES`, `MODULE_PROMPTS: Record<ProjectModule, string>` and the motivation phrases. The rules:
  - Small motivating steps.
  - `doer = human` only when AI can't do it without a person; otherwise `ai`, or `skill` when a Claude skill or slash command fits, naming it.
  - Every human task explains what, when and how in 2–6 short steps.
- `server/src/modules/planner/{routes.ts,service.ts}`.
- `shared/src/schemas/planner.ts`:
  - `planTaskSchema {title, doer, summary, steps[≤8], skill?, prompt?, dueDate?}`.
  - `motivationSchema {pace: relaxed|steady|intense, taskSize: tiny|small|medium, aiShare: max|balanced|human}`, which goes into `preferencesSchema` and `UserPreferences.motivation` (default `{steady, small, max}`).

**Routes** (rate-limited):

- `POST /api/planner/questions {module, name, description}` → 3–6 `{question, choices?}`.
- `POST /api/planner/plan {module, name, description, answers}` → `{ tasks }`. The n-th human task is due `today + n × {1,3,7}[pace]` days in the user's timezone.
- `POST /api/projects/:key/plan {tasks, agentId|null}` needs `task.create`. A worker that isn't a member yet is added with the member role (same checks as Task 5). Then it maps tasks to `NormalizedTask` and runs them through the existing `commitImport(…, { source: 'AI plan' })`:
  - Human tasks go to the caller.
  - AI and skill tasks go to the worker, labelled `AI` or `Skill`.
  - Descriptions are markdown with **What / When / How**, or the AI prompt, or the skill to run.
  - `checklist` = steps.

**Tests** (`server/test/planner.test.ts`, with `vi.stubGlobal('fetch')`):

- No key → 400.
- The Anthropic request carries the module prompt and motivation settings.
- Malformed output → 502.
- Pacing dates are right.
- A commit creates the tasks with checklists, labels and assignees, and the counters match.
- Viewer → 403.

Commit: `Generate questions and a step-by-step plan for a new idea with your AI`.

### Task 8: New-idea flow and motivation settings UI

**Create:** `client/src/features/planner/api.ts` and `client/src/features/planner/components/{IdeaQuestions,PlanPreview,DoerBadge}.tsx`, plus `client/src/features/settings/components/MotivationSettings.tsx`.

**Modify:**

- `CreateProjectModal.tsx`, now in steps:
  1. Details, with a "This is a new idea — plan it with AI" checkbox. When ticked, the primary button becomes **Generate**.
  2. Questions → **Create project & plan**.
  3. Preview, where tasks can be unticked and a worker picked → **Add N tasks**.

  If generation fails after the project exists, show **Try again** and **Open project**. With no key, link to Settings → AI.

- `AiSettings.tsx`: a "Motivation" section with three `SegmentedControl`s: deadlines pace, task size, who does the work.

Check in the browser at desktop width and 390 px. Commit: `Plan a new idea step by step when creating a project`. Push, then move BUGTRK-7 to **In Review**.

## BUGTRK-15: Household appointments

### Task 9: Appointment events

**Create** `server/src/db/migrations/016_appointments.sql`:

```sql
ALTER TABLE calendar_events ADD COLUMN is_appointment boolean NOT NULL DEFAULT false,
  ADD COLUMN reminders int[] NOT NULL DEFAULT '{}',
  ADD COLUMN reminders_sent int[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT calendar_events_appointment_project CHECK (NOT is_appointment OR project_id IS NOT NULL),
  ADD CONSTRAINT calendar_events_reminders_appointment CHECK (is_appointment OR reminders = '{}');
CREATE INDEX calendar_events_appointment_idx ON calendar_events (starts_at) WHERE is_appointment AND reminders <> '{}';
```

`reminders` holds minutes before the start (each 0–10080, at most 5). Changing `startsAt` or `reminders` resets `reminders_sent` in the same `UPDATE`, so a moved appointment reminds again.

**Create:**

- `client/src/components/ui/DurationPicker.tsx`: `{ value: minutes, onChange, options?, className, 'aria-label' }`, with 15 min–4 h presets and a custom value.
- `client/src/components/ui/ReminderPicker.tsx`: `{ value: number[], onChange, options?, className, 'aria-label' }`. Toggle chips for 2 d, 1 d, 2 h, 1 h, 30 min and 15 min. New appointments default to `[1440, 60]`.

**Modify:**

- `shared/src/schemas/calendar.ts`: `appointment` (defaults to false) and `reminders` (defaults to `[]`).
- `shared/src/types.ts`: `CalendarItem.appointment` and `CalendarItem.reminders`.
- `calendar/service.ts` and `routes.ts`: an appointment requires a household-module project (`400 Appointments belong to a household`) and not all-day.
- `EventModal.tsx`: an `appointment` mode with title, **location**, date, **start time**, **duration** (`endsAt = startsAt + duration`), **Remind**, who's going and notes.
- `CalendarItemChip.tsx` and `AgendaList.tsx`: a `CalendarClock` icon, location and duration.
- `HouseholdHomePage.tsx`: an "Appointments" card for the next 14 days with **Add**.
- `CalendarView.tsx`: "New appointment" in households.
- MCP `tools/calendar.ts`: `create_event` takes `appointment` and `reminders`, and `list_calendar` shows them.

**Tests:** in `server/test/calendar.test.ts`:

- An appointment in a household → 201 with its fields kept.
- In a software project, a personal calendar, or as all-day → 400.
- Reminders on a non-appointment → 400.
- Moving the start resets `reminders_sent`.

Commit: `Add appointments with a place, time, duration and reminders to households`. Push, then move BUGTRK-15 to **In Review**.

## BUGTRK-14: Telegram bot module

The bot works on any project whose owner's plan has `botAllowed(tier, module)`: Personal for households, Pro for every project. That check runs on every webhook call and every notification run. When it fails, the bot answers "This project's Telegram bot needs the <Plan> plan" and sends nothing.

### Task 10: Bot core and commands

**Create:**

- `server/src/db/migrations/017_telegram.sql`.
- `server/src/modules/telegram/api.ts`: `setWebhook`, a cached `getMe` username and `sendMessage`, over `fetch`.
- `server/src/modules/telegram/commands.ts`: a pure parser.
- `server/src/modules/telegram/handlers.ts`.
- `server/src/modules/telegram/service.ts`.
- `server/src/modules/telegram/routes.ts`.

**Modify:**

- `config.ts`: optional `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`.
- `app.ts`: `POST /telegram/webhook` outside `/api`, only when a token is set. `/api/config` gets `features.telegram`.
- `index.ts`: `setWebhook(APP_URL/telegram/webhook, secret_token, allowed_updates: ['message'])` at boot.
- `render.yaml` (`TELEGRAM_BOT_TOKEN sync:false`, `TELEGRAM_WEBHOOK_SECRET generateValue`) and `.env.example`.

```sql
ALTER TABLE users ADD COLUMN telegram_user_id bigint UNIQUE;
CREATE TABLE telegram_chats (
  chat_id bigint NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  is_group boolean NOT NULL,
  linked_by uuid REFERENCES users(id) ON DELETE CASCADE,
  notify text[] NOT NULL DEFAULT '{task_assigned,appointment_reminders,daily_digest}',
  only_mine boolean NOT NULL DEFAULT true,
  default_list_id uuid REFERENCES shopping_lists(id) ON DELETE SET NULL,
  digest_sent_on date,
  selected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, project_id));
CREATE INDEX telegram_chats_project_idx ON telegram_chats (project_id);
CREATE TABLE telegram_link_codes (
  code_hash bytea PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  is_group boolean NOT NULL,
  expires_at timestamptz NOT NULL);
```

A chat can follow several projects: a family group can follow the household and a side project. The chat's current project for commands is the row with the latest `selected_at` (the PK index covers `chat_id`). Linking sets it, and `use KEY` updates it.

**Linking:**

- Private: `t.me/<bot>?start=<code>`. Needs project membership.
- Group: `t.me/<bot>?startgroup=<code>`. Needs `project.edit`, because it shows project data to everyone in the group.
- Codes are 16 random bytes (base64url), valid 15 min, stored as sha256, and consumed with `DELETE … RETURNING`.
- `/start <code>` links `telegram_user_id → user` and the chat → project.

**Webhook:**

- Compare `X-Telegram-Bot-Api-Secret-Token` with `timingSafeEqual`, else 401.
- Only `message.text` is handled. Strip a leading `/` and `@<bot>`.
- Always answer 200 with the reply **inside the webhook response** (`{ method: 'sendMessage', chat_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }`). No second outbound request.
- Commands run as the sender's MSR user through the same guards as the HTTP routes.
- An unlinked sender gets "Connect your account: MSR → <project> → Settings → Telegram → Connect me".

**Commands**, case-insensitive. Items split on `,` and `and`; list and member names come from the project:

| Message                                                                            | Where     | Action                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add apples to store shopping list` / `add apples, milk to store list`             | Household | `addItem` to the named list                                                                                                                                                                                      |
| `apples` / `hammer` (anything else)                                                | Household | Add to the chat's default list (else the first list). In other projects, reply with help                                                                                                                         |
| `i bought apples and cheese` / `bought …`                                          | Household | Tick the matching unchecked items (exact, then singular/plural). Reply with what was ticked and what wasn't found                                                                                                |
| `?` / `<list name>?`                                                               | Household | All lists, or one list, with open items                                                                                                                                                                          |
| `open <name> list page` / `open list page`                                         | Household | `APP_URL/p/KEY/shopping?list=<id>` / `APP_URL/p/KEY/shopping`                                                                                                                                                    |
| `chores?` / `tasks?`                                                               | Any       | Open tasks grouped by person, with due dates and "Anyone" last                                                                                                                                                   |
| `mine?`                                                                            | Any       | The sender's open tasks                                                                                                                                                                                          |
| `KEY-12?` / `done KEY-12`                                                          | Any       | Task summary with link / move it to the first done status (`task.transition` rules)                                                                                                                              |
| `michael needs to wash the car today` (`today`, `tomorrow`, a weekday, `on 12/11`) | Any       | Create a task (a chore in households) for the member whose name starts with "michael", due on that date in the sender's timezone. Needs `task.create` and assign permission. An ambiguous name lists the matches |
| `appointments?`                                                                    | Household | The next 14 days of appointments with time, duration and place                                                                                                                                                   |
| `open project page` / `use KEY` / `help`                                           | Any       | Link / switch the chat's current project / command list                                                                                                                                                          |

`ShoppingPage.tsx` reads `?list=<id>` and scrolls to and highlights that list.

**Tests:**

- `server/test/telegramCommands.test.ts`: parser table tests for each row and the edge cases (`apples?` when no list is called "apples" → reply with the list names; `chores?` wins over a list called "chores"; names with spaces; `KEY-12?` vs a list name).
- `server/test/telegram.test.ts`, through the webhook with supertest:
  - Wrong secret → 401.
  - Private and group linking. A group link without `project.edit` → 403.
  - Every command against the DB.
  - A child role can add and tick items but can't create a task for someone else.
  - Unlinked sender, and a non-member sender.
  - Plan checks: a software project on Personal → the "needs Pro" reply; a household on Free → the "needs Personal" reply.

Commit: `Run any project from Telegram with commands for tasks, shopping lists and appointments`.

### Task 11: Bot notifications and appointment reminders

**Create** `server/src/modules/telegram/notifier.ts` (`runNotifications()`) and `server/src/db/migrations/018_telegram_notify.sql`:

```sql
CREATE TABLE telegram_state (id boolean PRIMARY KEY DEFAULT true CHECK (id), activity_cursor bigint NOT NULL);
INSERT INTO telegram_state (activity_cursor) SELECT coalesce(max(id), 0) FROM task_activity;
CREATE TABLE telegram_outbox (
  id bigserial PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  source_chat_id bigint,
  created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE tasks ADD COLUMN overdue_alerted_for date;
```

`NOTIFY_KINDS`, in `shared/src/modules.ts`: `task_created, task_assigned, status_changed, comments, daily_digest, overdue, priority_raised, appointment_reminders, shopping_changes, new_events`. The last two and appointment reminders are offered only on household projects.

**`index.ts`** runs `runNotifications()` every minute when Telegram is configured. Errors are logged as `'Telegram notifications failed'`. Each source is claimed in a single statement, so a run never sends anything twice, even with several instances:

1. **Task events, from the existing `task_activity`.** No changes to the task services.
   - Advance the cursor, holding back the newest 5 s so rows from still-open transactions aren't skipped:

     ```sql
     WITH prev AS (SELECT activity_cursor FROM telegram_state FOR UPDATE),
          next AS (SELECT coalesce(max(id), (SELECT activity_cursor FROM prev)) AS id FROM task_activity WHERE created_at < now() - interval '5 seconds')
     UPDATE telegram_state SET activity_cursor = greatest(prev.activity_cursor, next.id) FROM prev, next
     RETURNING prev.activity_cursor AS from_id, telegram_state.activity_cursor AS to_id
     ```

   - Then one query reads `task_activity` rows in `(from_id, to_id]` for projects that have chats, joined to task identifier/title, actor and assignee.
   - Mapping: `created` → task_created; `updated`+`assignee` → task_assigned; `updated`+`status` → status_changed; `commented` → comments; `escalated` where the new priority ranks higher → priority_raised.
2. **Outbox: shopping changes and new events.** These have no activity log.
   - `shopping/service.ts` (`addItem`, `clearChecked`) and `calendar/service.ts` (`createEvent` with a project) write with one conditional statement: `INSERT INTO telegram_outbox … SELECT … WHERE EXISTS (SELECT 1 FROM telegram_chats WHERE project_id = $1 AND $kind = ANY(notify))`. It does nothing when no one listens.
   - Bot-made changes pass `source_chat_id`, so they aren't echoed back to the chat that made them.
   - Claimed with `DELETE FROM telegram_outbox WHERE id IN (SELECT id … ORDER BY id LIMIT 500 FOR UPDATE SKIP LOCKED) RETURNING *`.
3. **Overdue:** `UPDATE tasks SET overdue_alerted_for = due_date WHERE completed_at IS NULL AND due_date < <today in assignee/reporter tz> AND overdue_alerted_for IS DISTINCT FROM due_date AND project_id IN (projects with an 'overdue' chat) RETURNING …`. Changing the due date re-arms it.
4. **Daily digest:** `UPDATE telegram_chats SET digest_sent_on = <local date of linked_by> WHERE 'daily_digest' = ANY(notify) AND <local time> >= '08:00' AND digest_sent_on IS DISTINCT FROM <local date> RETURNING …`. Then one query gets open tasks due today or overdue for those projects, grouped by person.
5. **Appointment reminders.** Only the closest due reminder is sent. Larger ones that were missed are marked sent with it, so a chat never gets "in 2 days" and "in 1 hour" at once:

   ```sql
   WITH due AS (
     SELECT e.id, min(m.minutes) AS minutes
     FROM calendar_events e CROSS JOIN LATERAL unnest(e.reminders) AS m(minutes)
     WHERE e.is_appointment AND e.reminders <> '{}' AND e.starts_at > now() AND e.starts_at <= now() + interval '7 days'
       AND e.starts_at - make_interval(mins => m.minutes) <= now() AND NOT m.minutes = ANY(e.reminders_sent)
     GROUP BY e.id)
   UPDATE calendar_events e SET reminders_sent = (SELECT array_agg(m) FROM unnest(e.reminders) m WHERE m >= due.minutes)
   FROM due WHERE e.id = due.id
   RETURNING e.id, e.project_id, e.title, e.location, e.starts_at, e.ends_at
   ```

**Fan-out:**

- Load the target chats for all claimed projects in one query, and drop projects whose owner's plan no longer allows the bot.
- A chat gets an event only when its kind is in `notify`.
- A private chat with `only_mine` gets task events only for tasks assigned to or reported by its user. It gets reminders only for appointments its user attends, or that have no attendees.
- **One message per chat per run**, its lines grouped by project. That stays under Telegram's 20 messages a minute per group.
- Times show in the chat user's timezone, with `APP_URL` links.
- A Telegram 403 (the bot was removed or blocked) deletes that chat's rows.

**Tests:** `server/test/telegramNotify.test.ts`, with `fetch` stubbed:

- Each kind reaches only the chats that enabled it.
- `only_mine` filtering.
- A second run sends nothing.
- A bot-made shopping add isn't echoed to its own chat.
- The digest is sent once per local day at 08:00, checked by setting the user's timezone so local time is past 08:00.
- Overdue fires once, and again after the due date changes.
- Reminders:
  - `[60]`, 30 min ahead → the group and the attendee's private chat get it; another member's private chat doesn't.
  - `[1440, 60]` first claimed 20 min ahead → only the 60-minute reminder.
  - Moving the appointment re-arms it.
- A lapsed plan sends nothing.
- A 403 removes the chat.
- Many events in one run → one message per chat.

Commit: `Push the notifications each Telegram chat picks, a daily digest and appointment reminders`.

### Task 12: Telegram settings UI

**Create:**

- `client/src/features/telegram/api.ts`.
- `client/src/features/telegram/components/TelegramSettings.tsx`.
- `client/src/features/telegram/components/ChatNotificationSettings.tsx`: `{ chat, kinds, canEdit, onChange }`, with a `Switch` per kind and "Only my tasks" for private chats.

**Modify:** `ProjectSettingsLayout.tsx` and `router.tsx`: a `settings/telegram` tab on every project. When the plan doesn't allow the bot, the tab shows a locked state with "Needs Personal" (households) or "Needs Pro" and a Shop link. The tab is hidden when `features.telegram` is off.

The page has:

- **Connect me** and **Add to a group** (the latter only with `project.edit`).
- Linked chats, each with its notification switches, a default list (households) and Unlink. A group chat needs `project.edit` to change; a private chat can only be changed by its own user.
- The one-time BotFather privacy note for groups.

**Server routes:**

- `GET /api/projects/:key/telegram`.
- `POST …/telegram/link {target}` → `{url}`.
- `PATCH`/`DELETE …/telegram/chats/:chatId`.
- `DELETE /api/me/telegram`.

Commit: `Connect any project to Telegram and choose what each chat is told`. Push, then move BUGTRK-14 to **In Review**. Add a comment on BUGTRK-14 that the bot is Telegram, not WhatsApp, and why.

### Task 13: MSR tasks for the manual steps and follow-ups, plus docs

Create these in BUGTRK with label `bot` or `modules`, assigned to Michael:

1. **Create the Telegram bot in BotFather**, with a checklist:
   - `/newbot` and copy the token.
   - `/setprivacy` → Disable, so plain words like "apples" reach the bot in groups.
   - `/setjoingroups` → Enable.
   - `/setcommands` (help, tasks, mine, chores, appointments).
2. **Set Telegram env vars on Render**: `TELEGRAM_BOT_TOKEN`, plus `TELEGRAM_WEBHOOK_SECRET` (`openssl rand -hex 32`) because the Blueprint value isn't applied to an existing service. Redeploy, then check the log line "Telegram webhook set".
3. **Link the family group and try every command and notification**, with a checklist from the command table, the notification kinds, and "an appointment 70 min ahead with a 1-hour reminder arrives".
4. **Custom bot commands** (backlog): a project admin sets a trigger word and one action: add to a list, create a preset task, or reply with saved text or a link.
5. **Choose a payment provider for plans and packs** (Stripe, Paddle or Lemon Squeezy) and **set real prices**, including the per-project price and the sale discount for the 10 and 25 packs (backlog). Everything stays free until then.
6. **Build the coming-soon modules**: Event, Home renovation, Job search, Trip and Fitness (backlog), each with its prompts and starter labels.

Docs:

- `README.md` bullets: Plans & Shop, modules, AI planning, AI workers, Appointments, Telegram bot.
- `docs/database.md`: migrations 014–018.
- `docs/server-architecture.md`: Plans & modules, AI workers, Planner, Appointments, Telegram commands and notifications; API reference and config rows.
- `docs/setup-requirements.md`: Telegram setup.

Commit: `Document plans, modules, AI workers, planning, appointments and the Telegram bot`, then push.

---

## Review focus

- **Plan and pack limits:** a per-user row lock + ledger count, so parallel creates never exceed the yearly count or a pack. Pack creations don't count toward the plan's yearly allowance. Deleting projects never frees a slot. An expired plan falls back to Free, and packs stay. Members never need a plan.
- **Worker isolation:** a worker connection can never reach the owner's other projects (`coalesce(agent_id, user_id)` + the cascade). Workers can't sign in, can't be added by email, and can't be made owner.
- **Planner output trust:** AI output is zod-validated with length caps, and markdown goes through the existing sanitizing renderer.
- **Telegram security:**
  - Secret header check; the reply goes in the webhook response; single-use 15-minute link codes.
  - Linking a group needs `project.edit`.
  - Commands run with the sender's own permissions.
  - The bot plan is rechecked on every use.
- **Notifications exactly once:** every source is claimed in one statement before sending, the activity cursor holds back the last 5 s, and there's one message per chat per run.
- **Timezones:** bot "today", planner dates, the 08:00 digest, overdue and reminder times all use the user's timezone.

## Verification

1. `pnpm lint && pnpm typecheck && pnpm test` pass, against the local Postgres (`docker compose up -d` or an existing instance).
2. `pnpm e2e` passes, including `19-plans.spec.ts`.
3. Manual check in the browser (Playwright/Chromium at desktop width and 390 px):
   - Plan cards list only implemented modules, and Coming-soon cards appear only in the grid.
   - Get Personal → a household; buy a 10 Startup pack → Startup on Free; Get Pro → Startup.
   - New idea → questions → preview → tasks with checklists, and AI tasks on the worker.
   - Make a connection an AI worker → add it with a role → assign it a task.
   - Add an appointment with a duration and reminders.
   - The Telegram tab shows its locked and unlocked states.
4. Telegram: `curl` the local webhook with sample Updates and the secret header, and check the JSON replies. Run `runNotifications()` with `fetch` stubbed. Michael checks it live after the Task 13 steps.
5. Update MSR: tickets to **In Review**, the new tasks created, and a comment on BUGTRK-14.
