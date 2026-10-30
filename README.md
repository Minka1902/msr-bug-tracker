# MSR Bug Tracker

A project and bug tracker with Kanban and List views, custom workflows, project roles, a dashboard and a command palette. Each project gets a color and icon, or a flag-style emblem with its own shape, pattern, part colors and dividers. It has two visual styles (Aurora and Clean), light and dark mode, and installs as an app on iPhone and Android.

On phones it is built for one hand: navigation, the + button and sheet buttons sit in the thumb zone, every tap target is at least 44 px, menus and pickers open as bottom sheets you swipe away, and task rows swipe to finish. Settings → Appearance has a left/right-hand mode and a Large touch size. Small tablets in portrait get an icon rail and a two-column board.

It also covers:

- **Modules and plans:** each project is a Software, Personal, Household, Skill or Startup project, with its own task types, starter labels and AI prompts. Yearly Free, Personal and Pro plans decide which modules you can start and how many new projects a year, and the Shop also sells 10- and 25-project packs for one module. Everything is free during launch.
- **AI planning:** a new idea gets a few clarifying questions from your own AI key, then a plan of small, dated steps. A step goes to you only when AI can't do it.
- **AI workers:** turn a connected AI app into a project member with its own role, then assign it tasks.
- **Households:** chores, errands, recurring tasks with turn-taking, Parent/Child/Guest roles, shared shopping lists, and appointments with a place, time, duration and reminders.
- **Telegram bot:** connect any project to a private chat or a family or team group. Add to shopping lists, list and add chores, finish tasks and check appointments by chat, and pick which updates, reminders and daily digest each chat gets.
- **Calendar:** month, week and agenda views; two-way sync with Google Calendar and iCloud; a subscribable feed for any calendar app; and a warning whenever a deadline or meeting overlaps a very important event.
- **Accounts:** email verification through Resend, two-factor sign-in with Google or Microsoft Authenticator, and saved Claude, ChatGPT, Gemini and Grok API keys.
- **AI connector:** a remote MCP server with OAuth sign-in, so Claude, ChatGPT and coding agents can read and update your projects, tasks, shopping lists and calendar. Settings → Connected apps has step-by-step setup for Claude, ChatGPT, Claude Code, Cursor, VS Code, Codex CLI, Gemini CLI and any other MCP client.
- **Sharing:** invite links over WhatsApp, Telegram, email or QR code, and an install QR code.
- **Moving data:** CSV and Excel import and export with a template, plus direct migration from ClickUp, Jira, Trello, Asana, Linear and GitHub Issues.

## Stack

- **Workspace:** a pnpm monorepo in TypeScript.
- **`client/`:** React 19, Vite, Tailwind v4, TanStack Query, Radix, dnd-kit and Tiptap. It is a PWA.
- **`server/`:** Express 5 and raw SQL via `pg` on PostgreSQL 16.
- **`shared/`:** zod schemas, enums, permission flags and identifier utilities used by both sides.

Docs: [database](docs/database.md) · [server architecture](docs/server-architecture.md)

## Getting started

```bash
cp .env.example .env
docker compose up -d          # Postgres 16 with msr_dev + msr_test (or create both yourself)
pnpm install
pnpm db:migrate
pnpm db:seed                  # optional: demo@msr.local / demo-password with demo data
pnpm dev                      # API on :4000, app on http://localhost:5173
```

Before the first `pnpm e2e`, install the browser once with `pnpm exec playwright install chromium`.

## Scripts

| Command                                      | What it does                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm dev`                                   | API (tsx watch) and client (Vite) together                                                      |
| `pnpm build` / `pnpm start`                  | Production build, then serve the API and the built client                                       |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | ESLint, tsc, and Vitest in every package                                                        |
| `pnpm e2e`                                   | Playwright e2e: recreates `msr_e2e`, builds, serves on :4300, runs desktop + iPhone + axe specs |
| `pnpm db:migrate`                            | Apply pending SQL migrations                                                                    |
| `pnpm db:seed`                               | Create a `demo@msr.local` login filled with demo data                                           |

## Deploy to Render

`render.yaml` is a Render Blueprint: a Docker web service (Starter) and a managed Postgres 16 database. Attachments and avatars are stored in a Cloudflare R2 bucket.

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and pick the repository.
3. When asked, fill in the variables below. The full checklist is in [docs/setup-requirements.md](docs/setup-requirements.md).
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`: the bucket and an Object Read & Write token for it. Without them, files are written to the container's disk and lost on every deploy.
   - `RESEND_API_KEY` and `MAIL_FROM`: `MAIL_FROM` must be an address on the domain you verified in Resend, for example `MSR Tracker <no-reply@example.com>`. Without these, verification and password-reset links go to the service log instead of being emailed.
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: optional, only needed for Google Calendar sync.
   - `TELEGRAM_BOT_TOKEN`: optional, from @BotFather. It turns on the Telegram bot; the webhook is registered on boot.
   - `ENCRYPTION_KEY`: the Blueprint generates it. Never change it once it's set.
4. Apply. The first deploy builds the image, runs migrations and goes live at `https://<service>.onrender.com`. `APP_URL` defaults to that address; set it yourself only if you add a custom domain.

Render backs up the database (point-in-time recovery on paid plans). Files in R2 stay put across deploys and restarts.

To try the production image locally:

```bash
docker build -t msr-tracker .
docker run --rm -p 4000:4000 -e DATABASE_URL=postgres://… -e APP_URL=http://localhost:4000 msr-tracker
```

## Install on iPhone

1. Open your Render URL in **Safari**.
2. Tap **Share** (on iOS 26, tap **···** first), then **Add to Home Screen**, then **Add**.
3. Open MSR from its icon. It runs full-screen with its own splash screen, and updates itself: when a new version is deployed you see a **Reload** prompt.

Settings → Install app shows the same steps, plus an **Install** button on Android and desktop Chrome or Edge.

## Backups

```bash
DATABASE_URL=postgres://… UPLOAD_DIR=/var/data/uploads scripts/backup.sh ./backups   # keeps the 14 newest
DATABASE_URL=postgres://… UPLOAD_DIR=/var/data/uploads scripts/restore.sh backups/db-….dump backups/uploads-….tar.gz
```

Both need the Postgres client tools (`pg_dump`, `pg_restore`). Use the database's **external** connection string when running them from your own machine.
