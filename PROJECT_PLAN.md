# ToDoList — Project Plan (v0.1, DRAFT for review)

> Status: **Planning only.** No code or visual design has been produced yet.
> The tech stack below is a **recommendation pending your approval** (you asked to review it before it's locked).

_Last updated: 2026-08-31_

---

## 1. Product summary

A **mobile-first, design-led, collaborative to-do web app**, self-hosted for a
small group (tens of users: friends & family), publicly reachable over the
internet. The single most important success criterion is that it **looks great
and feels great to use** — polished, custom, usable. Feature completeness is
secondary to experience quality.

### Guiding principles
1. **Design and usability come first.** Every feature is judged by how it feels on a phone.
2. **Custom, from the ground up.** No generic template look. A real design system.
3. **Accessible by default.** Keyboard, screen-reader, and contrast support are part of "polished," not an afterthought.
4. **Right-sized engineering.** Built for tens of users on one machine — avoid over-engineering, but keep a clean path to grow.

---

## 2. Confirmed requirements

| Area | Decision |
|---|---|
| Platform | Web app, **mobile-first**, installable **PWA** |
| Audience | Tens of users (friends/family), publicly accessible |
| Monetization | Free for now (no billing) |
| Design priority | **Highest** — custom, bespoke, usability-led |
| Theming | **Multiple built-in themes** (Tento / Nudge / Momentum), user-switchable in-app; each supports light + dark following system with manual override |
| Density & text size | User-configurable **Density** (Comfortable / Cozy / Compact) and **Text size** scale, under Settings → Appearance (also serves accessibility) |
| Accessibility | Built in from the start |
| Auth | Magic-link / passwordless via **Resend**; long-lived, self-refreshing sessions |
| Email | **Resend** (magic links + reminders) |
| Hosting | Self-hosted on a **Fedora** machine, Docker, exposed via **Cloudflare Tunnel** |
| Backups | Automated but basic |
| Branding | TBD — separate discussion |

### Must-have features (v1 target)
- Tasks with **due dates + reminders**
- **Recurring tasks**
- **Lists / projects + tags**, with **emoji icons for lists**
- **Collaboration**: invite to a list by email, assign tasks to members — kept simple (no complex role hierarchy)

### Explicit sequencing decisions
- **Collaboration is a v1 priority.** Real offline-first sync is deferred to a **later phase**.
- v1 PWA is **installable and online-first**; full offline + background sync comes later.

---

## 3. Recommended stack (for your review)

End-to-end **TypeScript**, single monorepo, containerized.

### Frontend
- **React + Vite + TypeScript** — SPA, fast, ideal PWA base.
- **vite-plugin-pwa (Workbox)** — installability now; offline caching expands in the offline phase.
- **Tailwind CSS** — the design-system foundation (design tokens for spacing/color/typography).
- **Radix UI primitives** — accessible, unstyled building blocks we style ourselves (keeps a11y guarantees while allowing a fully custom look).
- **Framer Motion** — the motion/animation layer that makes it feel premium.
- **TanStack Query** — server-state, caching, optimistic updates (also the seam we later extend for offline).
- **React Hook Form + Zod** — forms and validation (Zod schemas shared with the backend).

### Backend
- **Node.js + TypeScript**.
- **Hono** (lightweight, modern HTTP framework) — or Fastify if you prefer; I lean Hono.
- **tRPC** — end-to-end type safety between client and server (great fit for one TS codebase, tens of users).
- **PostgreSQL** — primary datastore.
- **Drizzle ORM** — typed schema + migrations, lightweight.
- **Better Auth** — magic-link plugin wired to Resend, rotating long-lived sessions (httpOnly cookies) so users rarely re-auth. (Chosen over legacy options because it's actively maintained and self-host-friendly.)
- **pg-boss** — Postgres-backed job queue/scheduler for **reminders** and **recurring-task materialization** (no extra infra since we already run Postgres).
- **Resend SDK** — transactional email.

### Infrastructure
- **Docker Compose** on Fedora: `app` (web+api), `worker` (jobs), `postgres`, `cloudflared` (Cloudflare Tunnel).
- **pnpm workspaces** monorepo with a shared `types`/`schema` package.
- **Backups**: nightly `pg_dump` to a mounted volume + off-box copy (second disk or a cloud bucket), with retention. Optional later: continuous WAL streaming (Litestream/wal-g).

### Design decisions baked in early to make later phases cheaper
- Every entity carries a **client-generatable UUID**, `createdAt`, `updatedAt`, and **soft-delete `deletedAt`** — so the eventual offline/sync phase doesn't require a data-model rewrite.
- Recurrence stored as **iCal RRULE** strings.

> ⚠️ **Please confirm or amend this stack before Phase 0.** Swappable without much cost: Hono↔Fastify, tRPC↔REST. Costly to swap later: Postgres, the auth library, the monorepo/PWA shape.

---

## 4. Data model (first sketch)

- **user** — id, email, displayName, **avatarEmoji, avatarColor** (emoji + color identity for quick visual differentiation in shared lists/assignees; **user-chosen** via an emoji+color picker in profile settings), createdAt
- **user_prefs** — userId, theme (tento|nudge|momentum), appearance (system|light|dark), density (comfortable|cozy|compact), textScale (float), updatedAt
- **session** — id, userId, token (rotating), expiresAt
- **magic_link** — id, email, token, expiresAt, consumedAt
- **list** — id, ownerId, name, **emojiIcon**, color, sortOrder, createdAt, updatedAt, deletedAt
- **list_member** — listId, userId, addedAt (simple shared access; owner vs member only)
- **list_invite** — id, listId, email, token, status, expiresAt (invite-by-email flow)
- **task** — id, listId, title, notes, dueAt, priority, completedAt, assigneeId, **recurrenceRule (RRULE)**, parentTaskId (subtasks), sortOrder, createdAt, updatedAt, deletedAt
- **tag** — id, ownerId/listId, name, color
- **task_tag** — taskId, tagId
- **reminder** — id, taskId, sendAt, channel (email now; push later), sentAt
- **notification** — id, userId, type, payload, readAt (in-app activity feed)

---

## 5. Proposed build order (phased roadmap)

Ordering protects the top priority: **get the design system and core feel right first**, then layer collaboration, then offline.

**Phase 0 — Foundations & design system**
- Monorepo, Docker Compose, Postgres, Cloudflare Tunnel, CI checks.
- Magic-link auth end-to-end (Resend), rotating sessions.
- **Design system**: tokens, light/dark theming, typography scale, core accessible components, motion language, app shell, installable PWA scaffold. _This is where the "great design" bar is set._

**Phase 1 — Core task management (single user)**
- Lists with **emoji icons**, tasks CRUD, due dates, priorities, tags.
- Mobile-first interactions: swipe, drag-reorder, quick-add, gestures, empty states, native-feel polish.

**Phase 2 — Reminders & recurring tasks**
- pg-boss scheduler; email reminders via Resend; RRULE recurrence with materialization on completion/schedule.

**Phase 3 — Collaboration (v1 priority)**
- Invite-by-email to a list, membership, task assignment.
- Live updates for shared lists (WebSocket/SSE) with optimistic UI.
- In-app notifications / activity.

**Phase 4 — Offline-first (deferred)**
- Local cache (IndexedDB) + outbox mutation queue + background sync + conflict resolution (last-write-wins via `updatedAt`, upgradable). Evaluate a sync engine (ElectricSQL / Zero / PowerSync / RxDB) vs. a hand-rolled layer.

**Phase 5 — Hardening & operations**
- Automated backups + restore drills, monitoring/uptime, email deliverability (domain verification, SPF/DKIM/DMARC), performance budget, PWA/offline polish, security review.

---

## 6. Key risks & open questions

1. **Brand identity** is unresolved (name, palette, typography, logo). Needed before/within Phase 0 to hit the design bar. — _separate discussion_
2. **Self-hosting reliability**: the app's uptime is tied to a home PC + home internet + Cloudflare Tunnel. Acceptable for friends/family; note it.
3. **Email deliverability**: Resend needs a verified sending domain (SPF/DKIM/DMARC) so magic links/reminders don't hit spam. Which domain will we send from?
4. **Offline + collaboration together** is the hardest combination; we've de-risked it by sequencing collaboration first and designing the schema to be sync-ready.
5. **Backups**: where does the off-box copy go (second disk, NAS, cloud bucket)?
6. **Scope creep**: subtasks, attachments, comments, calendar view, natural-language date entry — all tempting; parked unless you want them in v1.

---

## 7. Decisions still needed from you

- [ ] Approve or amend the **stack** (Section 3).
- [ ] Sending **domain** for Resend.
- [ ] Off-box **backup destination**.
- [ ] Whether to start **branding** now or after Phase 0 scaffolding.
- [ ] Confirm the **phase order** (esp. Reminders vs. Collaboration — currently Reminders in Phase 2, Collaboration in Phase 3).
