# Personal OS

A single-user "operating system for one life": one private dashboard that pulls calendar, training, recovery, finances, journal and social signals into one place, with an AI assistant that can read across all of it. Built by one person, for one person, as a working prototype of what a personal data layer looks like when you actually own it.

**Stack:** Next.js 16 (App Router, React 19), Supabase (Postgres + Auth, RLS on every table), Tailwind, pnpm, Vercel; plus an Expo (React Native) client in `mobile/`. Web modules today: dashboard, health, train, finance, journal, social, agent, settings.

## Integrations

| Source | What it syncs | How |
|---|---|---|
| Google Calendar | events | OAuth; Vercel cron every 5 min (`/api/google-calendar/sync`) |
| Whoop | recovery, sleep, strain, workouts | OAuth; Vercel cron hourly (`/api/whoop/sync`) |
| Strava | activities | OAuth (`feature/strava`, and the Stride sub-app) |
| Apple Health | workouts | export-XML import (`feature/apple-health`, Stride) |
| Plaid | bank transactions only (no Auth/Identity/Income products) | Link flow |
| X / Twitter | follower counts | `feature/x-twitter` |

Connections are managed from Settings; each integration can be disconnected independently.

## Security and privacy

- **Encryption at rest for tokens.** Every third-party OAuth/refresh token is encrypted with AES-256-GCM (`src/lib/crypto/tokens.ts`) using a server-side `TOKEN_ENCRYPTION_KEY` before it touches the database. The key never ships to the client.
- **Cron isolation.** Sync routes run on Vercel cron; a per-user try/catch means one failing account never aborts the batch, and middleware gates cron routes behind their own auth check.
- **Public privacy policy** at `/privacy`, written for the Google and Whoop OAuth consent reviews.
- No secrets in the repo: copy `.env.example` to `.env.local` and fill in your own keys.

## Tests

- Unit (Vitest): token encryption round-trip, Google Calendar mapping, integrations store, Supabase middleware, sync staleness, Whoop health and workout parsing — `pnpm test`.
- End-to-end (Playwright): first sign-in, connections page, Whoop flow, PWA install, secondary pages — `pnpm test:e2e`.

## Run locally

```bash
pnpm install
cp .env.example .env.local   # Supabase, Google, Whoop, TOKEN_ENCRYPTION_KEY
pnpm dev
```

Database schema lives in `supabase/migrations/`.

## Branches worth knowing

- **`feature/app-alive`** — where the Expo (React Native) client and the AI assistant were built; merged into `main` on 2026-09-09 (PR #12), so `main` now carries both the web app and `mobile/`.
- **`wip/stride-2026-06`** — snapshot of *Stride*, a local-first marathon-training sub-app (plan builder, run log, recovery check-ins, Apple Health/Strava import, optional AI coach) that lived uncommitted on main from June to September 2026.
