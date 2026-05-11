# Vine Tracker

> A Christian spiritual discipline platform for tracking habits, growing in community,
> and walking faithfully — together.

Vine Tracker helps believers cultivate consistent spiritual rhythms (prayer, scripture
reading, journaling, fasting, service) and stay accountable through groups, mentorships,
and structured programs. The app is offline-first, privacy-first, and designed to feel
calm, focused, and Apple-clean.

---

## 1. Project Overview

**Mission.** Help every believer take ownership of their walk with God — daily, weekly,
and monthly — through structured tracking, gentle reminders, scripture, and community
accountability that respects privacy.

**Core principles**
- Personal data (logs, notes, journals) is **private by default**.
- New accounts start **completely empty** — no fake activities, streaks, or content.
- The app is fast, offline-capable, and works on phones, tablets and desktops.

**Primary surfaces**
- **Home** — daily/weekly/monthly goals, daily verse, quick actions
- **Activities** — log spiritual disciplines (prayer, reading, fasting, service…)
- **Bible** — full offline access to all 66 books
- **Programs** — guided spiritual programs with progress and broadcasts
- **Groups** — community accountability with chat, members and roles
- **Mentorships** — 1:1 spiritual guidance
- **Journal / Calendar / Notifications / Profile**

---

## 2. Architecture

### Frontend
- **React 18 + TypeScript + Vite 5**
- **Tailwind CSS v3** with a semantic token design system
- **shadcn/ui** primitives, customized via design tokens (light / dark / midnight themes)
- **Framer Motion** for purposeful motion
- **PWA**: installable, service worker, offline shell

### Backend (Lovable Cloud, powered by Supabase)
- **PostgreSQL** with strict Row-Level Security (RLS)
- **Supabase Auth** (Email/Password, Google, Apple)
- **Supabase Storage** for chat media and avatars
- **Supabase Realtime** for chat, notifications, presence
- **Edge Functions (Deno)** for cron-driven activity reminders and push delivery
- **pg_cron + pg_net** for scheduled background jobs

### Realtime systems
- Group chat, DMs, notifications and program broadcasts use `postgres_changes`
  channels filtered per row (`group_id`, `conversation_id`, `user_id`) so only
  relevant rows fan out.
- A global `DATA_CHANGE_EVENT` event bus forces local hooks to refetch on mutation
  instead of leaning on a heavy global state store.

### Offline systems
- **IndexedDB action queue** for activity logs, journal entries and bible reads
  created while offline — flushed to Supabase on reconnect.
- Bible content is cached locally so all 66 books are available without a network.

---

## 3. Authentication System

Supabase Auth handles identity. Three providers are available:

| Provider | Notes |
|----------|-------|
| **Email + Password** | Standard sign-up/sign-in. Email verification required (no anonymous sign-up). |
| **Google** | OAuth via Supabase, prompt set to `select_account`. |
| **Apple** | OAuth via Lovable Cloud-managed Apple service. |

**Sessions**
- JWT-based, stored by the Supabase JS client.
- `onAuthStateChange` drives the `AuthContext`.
- A Postgres trigger creates a `profiles` row automatically on user creation.

**Password reset**
- Public `/forgot-password` route → `supabase.auth.resetPasswordForEmail(...)`.
- Public `/reset-password` route handles the recovery event and calls
  `supabase.auth.updateUser({ password })`.

---

## 4. Database Structure

All app data lives in the `public` schema. Roles live in a **separate** table to
prevent privilege-escalation bugs.

### Core tables

| Table | Purpose |
|-------|---------|
| `profiles` | Public-safe user profile (name, avatar, title). |
| `user_roles` | (user_id, role) — `admin` / `moderator` / `user`. |
| `activities` | Spiritual discipline logs (status: planned / ongoing / completed). |
| `journal_entries` | Long-form personal journal. Always private. |
| `goals` | Daily / weekly / monthly goals tied to a user. |
| `groups`, `group_members`, `group_messages` | Community groups, membership and chat. |
| `conversations`, `conversation_messages` | 1:1 direct messages. |
| `programs`, `program_enrollments`, `program_messages` | Guided programs and broadcasts. |
| `mentorships`, `mentorship_notes` | 1:1 mentorship relationships. |
| `notifications` | Per-user notification feed (deep-linkable). |
| `feedback_reports` | User feedback / bug reports. |
| `activity_reminders_sent` | Dedup table for cron-fired reminders. |

### Relationships
- `profiles.id = auth.users.id` (1:1, **never** FK to `auth.users` directly).
- `group_members.group_id → groups.id`, `group_members.user_id → profiles.id`.
- `group_messages.group_id → groups.id`, sender → `profiles.id`.
- `conversation_messages.conversation_id → conversations.id`.

### Permissions & RLS

Every table has **RLS enabled**. Policies follow these rules:

- **Owner-only** for personal data (`activities`, `journal_entries`, `notifications`,
  `feedback_reports`).
- **Group-scoped** for group artifacts: `has_group_membership(auth.uid(), group_id)`.
- **Moderator/owner-elevated** writes via `is_group_moderator(auth.uid(), group_id)`.
- Role checks always go through a `SECURITY DEFINER` helper (`has_role(uid, role)`)
  to avoid recursive RLS.
- All `SECURITY DEFINER` helpers have `EXECUTE` revoked from `PUBLIC`/`anon`
  and granted only to `authenticated` where required at runtime.

---

## 5. Notification System

### Realtime feed
- The `notifications` table streams via `postgres_changes` filtered by
  `user_id=eq.<me>`.
- Each row carries a `kind`, `title`, `body`, and a structured `link` payload.

### Activity reminders
- A `pg_cron` job runs every minute and `pg_net.http_post`s the
  `schedule-activity-reminders` Edge Function.
- The function scans `activities` with `status='ongoing'` and an upcoming
  `start_at`, inserts a notification, dedups via `activity_reminders_sent`,
  and (where subscribed) sends a Web Push.

### Push notifications
- The browser `PushManager` subscription is stored per device.
- The `send-push` Edge Function delivers payloads over Web Push (VAPID).
- Service Worker (`src/sw.ts`) handles the `push` event and surfaces a
  notification, **including a `data.link` field**.

### Deep linking
- Clicking a notification (in-app or system) opens the `link` and routes to
  the precise resource — e.g. `/groups/<id>?msg=<messageId>`,
  `/activities/<id>`, `/programs/<id>`.

---

## 6. Group System

### Membership
- Groups can be **public** or **invite-only** (join by invite code).
- `group_members.status` tracks `pending` / `active` / `left` / `removed`.
- Re-joining is supported (status flips back to `active` on accepted invite).

### Roles
| Role | Permissions |
|------|-------------|
| `owner` | Full control: rename, delete, archive, assign roles, full moderation. |
| `co_leader` | Moderation: delete messages, remove members, manage basic settings. |
| `member` | Chat, view roster, react. |

Role checks are enforced **both** in RLS (`is_group_moderator`) and in the UI
to keep the experience predictable.

### Chat
- Realtime via `postgres_changes` filtered by `group_id`.
- Optimistic send with rollback on failure.
- Server-side **rate limiting**: a `BEFORE INSERT` trigger caps any user at
  30 messages/minute per chat surface.
- Spam/profanity filter on the client before insert.
- Media attachments (image/video/audio/files) via the `chat-media` bucket.
- Reply, hide (per-user), delete (own), remove (moderator).

---

## 7. Program System

Programs are discoverable, guided spiritual journeys.

### Progress calculation
- A program defines a set of items / sessions.
- A user’s progress = `completed_items / total_items` over their enrollment.
- Updates happen when the user marks an item complete; the value is recomputed
  client-side and persisted to `program_enrollments.progress`.

### Updates & broadcasts
- `program_messages` is a **read-only** broadcast channel: only the program
  owner can post; enrolled users receive realtime updates.

### Notes
- Personal notes on a program are stored privately and visible only to the
  author.

### Visibility
- Programs can be **public** (discoverable) or **private** (invite-only).
- Even on public programs, individual progress and notes remain private.

---

## 8. Offline Functionality

### Offline Bible
- All 66 books are cached in IndexedDB on first read.
- The Bible page works fully without a network.

### Offline activity creation
- Activity logs created offline are pushed onto an **action queue** in IndexedDB.
- The service worker / app shell flushes the queue to Supabase on reconnect.
- Conflict resolution is last-write-wins, scoped per record.

### Sync behavior
- A connectivity banner (`OfflineBanner`) surfaces state.
- After reconnect, the global `DATA_CHANGE_EVENT` fires so dependent hooks
  refetch the latest server truth.

---

## 9. Security

### Row-Level Security
- RLS is **enabled on every table**.
- Policies are written against `auth.uid()` and `SECURITY DEFINER` helpers.
- Personal records (logs, notes, journal, notifications) are owner-only.

### Auth protection
- No anonymous sign-ups.
- Email verification required.
- Recovery flow gated to the dedicated `/reset-password` route.

### CORS
- Edge Functions do **not** use `*`. A dynamic whitelist permits:
  - the published custom domains,
  - `*.lovable.app` / `*.lovable.dev` previews,
  - `localhost` during development.

### Rate limiting
- A Postgres `BEFORE INSERT` trigger (`enforce_message_rate_limit`) caps users
  at 30 messages/minute on `group_messages` and `conversation_messages`.

### Environment variables
- Public client values live in `.env` (auto-managed by Lovable Cloud):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
- **Service role keys never leave the server.** Edge Functions read secrets
  from the Supabase Functions environment only.

---

## 10. Setup Instructions

### Environment variables
The `.env` is generated automatically by Lovable Cloud. Do not hand-edit. If
running outside Lovable, provide:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

### Backend (Supabase / Lovable Cloud)
1. Lovable Cloud is enabled — a Supabase project is provisioned automatically.
2. Migrations live in `supabase/migrations/` and apply on deploy.
3. Edge Functions live in `supabase/functions/` and deploy automatically.

### Local development
```sh
npm install
npm run dev
```
The app runs at `http://localhost:5173`.

### Deployment
- Push to `main` → Lovable builds and publishes.
- Default URL: `https://vine-track.lovable.app`.
- Custom domain: configurable in Project → Settings → Domains.

---

## 11. Performance Optimization

- **Indexes** on every hot path:
  - `group_messages(group_id, created_at DESC)`
  - `conversation_messages(conversation_id, created_at DESC)`
  - `notifications(user_id, created_at DESC)`
  - `activities(user_id, status)`, `group_members(user_id, status)`,
    `conversations(user_1)`, `conversations(user_2)`
- **Pagination** on all chat surfaces (page size 30, infinite scroll up).
- **Lazy loading** of media (`loading="lazy"`, signed URLs on demand,
  client-side image compression before upload).
- **Realtime channels** are filtered server-side by row, not by table, to
  keep fan-out tiny.
- **Code-splitting** via Vite per route.
- **Service Worker** caches the app shell for instant repeat loads.

---

## 12. Future Scalability

The architecture is designed to scale to millions of users without rewrites:

- **Postgres + RLS** scales vertically and horizontally; hot tables already
  carry covering indexes.
- **Realtime fan-out** is per-row filtered, so a 10× increase in users does
  not multiply each subscriber’s traffic.
- **Edge Functions** are stateless and horizontally scalable.
- **Storage** lives behind a CDN; signed URLs allow per-asset access control
  without bottlenecking the API.
- **pg_cron + pg_net** allow background work to scale independently from the
  request path.
- **PWA + IndexedDB** offload reads from the server for offline / repeat use.
- **Rate limiting at the DB layer** protects shared resources from any one
  user, regardless of client.

Future levers: read replicas for analytics, partitioning of `group_messages`
and `notifications` by month, and a dedicated worker queue (e.g. via
`pg_net` + a job table) for heavy fan-out (mass broadcasts, digest emails).

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Blank screen after login | Stale service worker in preview iframe | Hard refresh; SW is disabled in dev/preview by design. |
| `new row violates row-level security policy` | Missing `user_id = auth.uid()` on insert | Ensure inserts include the current user's id. |
| Realtime not firing | Table not added to `supabase_realtime` publication | `ALTER PUBLICATION supabase_realtime ADD TABLE public.<t>;` |
| Push notifications silent on iOS | iOS requires the PWA installed to home screen first | Install via Safari → Share → Add to Home Screen. |
| `Rate limit exceeded` on chat send | DB trigger cap (30 msgs/min) reached | Wait one minute, then retry. |
| Edge Function CORS error | Origin not in whitelist | Add the deployed origin to `ALLOWED_ORIGINS` in the function. |

---

## 14. Self-Hosting / Independent Deployment

The app is portable. To run it outside Lovable:

1. **Provision a Supabase project** and apply every file in `supabase/migrations/`
   in order (`supabase db push`).
2. **Deploy Edge Functions** in `supabase/functions/` (`supabase functions deploy <name>`).
3. **Configure secrets** in the Supabase dashboard:
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, plus Google/Apple
   OAuth credentials in Auth → Providers.
4. **Schedule reminders** with `pg_cron`:
   ```sql
   select cron.schedule(
     'activity-reminders', '* * * * *',
     $$select net.http_post(
        url := 'https://<ref>.supabase.co/functions/v1/schedule-activity-reminders',
        headers := jsonb_build_object('Authorization','Bearer '||current_setting('app.settings.service_role_key',true)))$$);
   ```
5. **Build & deploy the frontend** to any static host (Vercel, Netlify, Cloudflare
   Pages, S3+CloudFront):
   ```sh
   npm ci && npm run build
   # serve ./dist
   ```
   Make sure the host serves `index.html` for unknown routes (SPA fallback).
6. **Required env vars** at build time:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

There is **no platform lock-in** — the codebase only depends on standard
Supabase APIs and a static host.

---

## License

Proprietary — © Vine Tracker. All rights reserved.
