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
docker compose up -d          # or use a local Postgres 16 and create msr_dev + msr_test
pnpm install
pnpm db:migrate
pnpm dev                      # API on :4000, app on http://localhost:5173
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | API (tsx watch) and client (Vite) together |
| `pnpm build` / `pnpm start` | Production build, then serve the API and the built client |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | ESLint, tsc, and Vitest in every package |
| `pnpm e2e` | Playwright end-to-end tests |
| `pnpm db:migrate` | Apply pending SQL migrations |
| `pnpm db:seed` | Create a `demo@msr.local` login filled with demo data |
