# ToDoList

A mobile-first, design-led, collaborative to-do PWA. Self-hosted on Fedora behind a
Cloudflare Tunnel. See [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) for the full product plan and
[`design-prototype/index.html`](./design-prototype/index.html) for the approved visual design
(open it in any browser — no tooling required).

## Stack

- **Web** — React + Vite + TypeScript PWA, Tailwind (CSS-variable theming), Framer Motion, TanStack Query
- **API** — Node + Hono + tRPC, Better Auth (magic link via Resend, long-lived rotating sessions)
- **Data** — PostgreSQL + Drizzle ORM
- **Jobs** — pg-boss (reminders + recurring tasks)
- **Infra** — Docker Compose, Cloudflare Tunnel, nightly `pg_dump` backups

## Repository layout

```
apps/
  web/      React PWA + design system (3 themes, density, text-scale, emoji identities)
  api/      Hono + tRPC + Better Auth
  worker/   pg-boss: reminders (1m) + recurrence (15m)
packages/
  db/       Drizzle schema, client, migrations
  shared/   Enums + Zod validators shared by API and web
infra/      Dockerfiles + nginx config
docker-compose.yml
```

## Prerequisites

- **To run the whole stack:** Docker + Docker Compose (this is all you need on the Fedora host).
- **To develop with hot reload:** Node ≥ 20.11 and pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`).

## Quick start (production / self-host on Fedora)

```bash
cp .env.example .env
# Edit .env — set AUTH_SECRET (openssl rand -hex 32), Resend keys, Postgres password,
# WEB_ORIGIN (your public https URL), and CLOUDFLARE_TUNNEL_TOKEN.

docker compose up -d --build
```

This brings up Postgres, runs migrations, then starts the API, worker, web (nginx), the
Cloudflare Tunnel, and the nightly backup job. Point your tunnel's public hostname at
`http://web:80`.

## Local development

```bash
corepack enable
pnpm install

# Start just Postgres in Docker:
docker compose up -d postgres

# Point .env DATABASE_URL at localhost, then run migrations:
pnpm db:migrate

# Run web + api + worker together (hot reload):
pnpm dev
# → web  http://localhost:5173
# → api  http://localhost:8787
```

Useful scripts: `pnpm db:generate` (new migration from schema changes), `pnpm db:studio`,
`pnpm typecheck`, `pnpm lint`, `pnpm format`.

## Cloudflare Tunnel

1. In the Cloudflare Zero Trust dashboard, create a **Tunnel** and copy its token into
   `CLOUDFLARE_TUNNEL_TOKEN` in `.env`.
2. Add a **public hostname** (e.g. `todo.yourdomain.tld`) routing to `http://web:80`.
3. Set `WEB_ORIGIN=https://todo.yourdomain.tld` in `.env` (magic-link URLs and CORS use it).

## Resend (email)

Magic-link sign-in and reminders both send through Resend.

1. Create an API key → `RESEND_API_KEY`.
2. **Verify a sending domain** in Resend and set the DNS records (SPF/DKIM/DMARC) so mail
   doesn't land in spam. Magic links are useless in spam.
3. Set `EMAIL_FROM`, e.g. `EMAIL_FROM="ToDoList <hello@yourdomain.tld>"`.

## Backups

The `backup` service writes `./backups/todolist-<timestamp>.sql.gz` nightly and prunes files
older than 14 days. **These live on the same machine** — copy them off-box (NAS / second disk /
cloud bucket) for real safety.

Restore:

```bash
gunzip -c backups/todolist-YYYY-MM-DD-HHMM.sql.gz | \
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

## Auth schema note

The `user` / `session` / `account` / `verification` tables follow Better Auth's expected shape.
If you change them, run `pnpm --filter @todolist/api auth:generate` to confirm they still match.

## Before going live — open items

- [ ] Choose and verify the **Resend sending domain**.
- [ ] Decide the **off-box backup destination** and automate copying `./backups` there.
- [ ] Generate a strong `AUTH_SECRET`.
- [ ] Add real PWA icons (`apps/web/public/icon-192.png`, `icon-512.png`).

## Status

Phase 0 scaffold complete: monorepo, DB schema, magic-link auth, reminder/recurrence worker,
web design system + app shell, Docker/Cloudflare/backup infra. Next: wire the web app to the
tRPC API (replace sample data), then build out the remaining screens per the prototype.
