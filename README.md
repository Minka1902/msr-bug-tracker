# MSR Bug Tracker

A project and bug tracker with Kanban and List views, custom workflows, project roles, a dashboard and a command palette. It has two visual styles (Aurora and Clean), light and dark mode, and installs as an app on iPhone.

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

`render.yaml` is a Render Blueprint: a Docker web service (Starter), a managed Postgres 16 database and a 1 GB disk for attachments.

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and pick the repository.
3. When asked, fill in `RESEND_API_KEY` and `MAIL_FROM` (an address on the domain you verified in Resend, for example `MSR Tracker <no-reply@example.com>`). Without them, verification and password-reset links are written to the service log instead of being emailed. See [docs/setup-requirements.md](docs/setup-requirements.md).
4. Apply. The first deploy builds the image, runs migrations and goes live at `https://<service>.onrender.com`. `APP_URL` defaults to that address; set it yourself only if you add a custom domain.

The Starter plan is required for the persistent disk. Render backs up the database (point-in-time recovery on paid plans) and snapshots the disk daily.

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
