# Personal OS — Plan 1A.2: Design System + Full Database Schema

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is explicitly structured for **parallel multi-agent execution** — see the Wave Map below.

**Goal:** Install the complete Personal OS design-token system (all three theme palettes + three fonts + Tailwind 4 mapping) and create all remaining database tables (the 17 module/identity/observability tables beyond `profiles`), so every future module plan has both its visual vocabulary and its data layer ready.

**Architecture:** All design tokens live as CSS custom properties in `globals.css` — dark theme on `:root`, cream/warm as `[data-theme]` overrides — and are exposed to Tailwind 4 via an `@theme` block that references them (so utility classes resolve per active theme). Fonts load through `next/font/google` (self-hosted, no layout shift). The database grows through one migration file per domain; all files are written in parallel then applied together in timestamp order via a single `supabase db push`. Two deferred items from Plan 1A.1's final review are folded in.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript strict, Supabase (Postgres + RLS), `next/font/google`, Vitest, Playwright.

**Spec reference:** `docs/superpowers/specs/2026-05-21-personal-os-design.md` — Section 3 (Data Model), Section 5.3 (Theme System). Design tokens sourced from `design_handoff_personal_os/prototype/hearth.css` and `design_handoff_personal_os/prototype/app/app.css`.

---

## Wave Map (for parallel execution)

The controller dispatches tasks in waves. Within a wave, all tasks run concurrently (independent file sets, strict per-task `git add <path>` — never `git add .`). Reviews (spec + quality) gate progression to the next wave.

| Wave | Tasks (parallel) | Why parallel-safe |
|---|---|---|
| **Wave 1** | Task 1 (design system), Task 2 (login error fix), Task 3 (remove scaffold SVGs), Tasks 4–15 (12 migration files) | Disjoint file sets: `globals.css`+`layout.tsx` / `login/page.tsx` / `public/` / 12 distinct `supabase/migrations/*.sql` files |
| **Wave 2** | Task 16 (token swatch page — needs Task 1), Task 17 (apply migrations + generate types — needs Tasks 4–15) | Swatch page touches a new route file; migration apply touches DB + `database.types.ts` + client helpers. No overlap. |
| **Wave 3** | Task 18 (acceptance gate walkthrough) | Sequential — verifies everything |

**Migration timestamp discipline:** filenames are pre-assigned in this plan (e.g. `20260527120002_*`). Agents create the file at the EXACT path given — they do NOT run `pnpm supabase migration new` (which would auto-timestamp and risk collisions across parallel agents). `db push` (Task 17) applies them in filename order.

---

## File Structure (after this plan)

```
/Users/me/Projects/Personal OS/
├── src/
│   ├── app/
│   │   ├── layout.tsx                        [MODIFY — add 3 next/font families]
│   │   ├── globals.css                       [MODIFY — full token system + @theme]
│   │   ├── (auth)/login/page.tsx             [MODIFY — display ?error= param]
│   │   └── dev/tokens/page.tsx               [CREATE — token swatch verification page]
│   └── lib/supabase/
│       ├── database.types.ts                 [CREATE — generated from remote schema]
│       ├── client.ts                         [MODIFY — type with Database]
│       ├── server.ts                         [MODIFY — type with Database]
│       └── middleware.ts                     [MODIFY — type with Database]
├── public/                                    [DELETE 5 scaffold SVGs]
└── supabase/migrations/
    ├── 20260527120001_create_integrations_and_agent_messages.sql  [CREATE]
    ├── 20260527120002_create_tasks.sql                            [CREATE]
    ├── 20260527120003_create_habits.sql                           [CREATE]
    ├── 20260527120004_create_calendar_events.sql                  [CREATE]
    ├── 20260527120005_create_finance.sql                          [CREATE]
    ├── 20260527120006_create_nutrition.sql                        [CREATE]
    ├── 20260527120007_create_health_snapshots.sql                 [CREATE]
    ├── 20260527120008_create_social_followers.sql                 [CREATE]
    ├── 20260527120009_create_training.sql                         [CREATE]
    ├── 20260527120010_create_journal_entries.sql                  [CREATE]
    ├── 20260527120011_create_gmail_threads.sql                    [CREATE]
    └── 20260527120012_create_observability.sql                    [CREATE]
```

---

## Shared Conventions (every migration follows these)

Each module table follows this exact pattern. **Read this once; it applies to Tasks 4–15.**

1. **`user_id uuid not null references auth.users(id) on delete cascade`** on EVERY table (denormalized onto child tables like `habit_logs` so RLS can filter without joins).
2. **RLS enabled** + four policies per table (own-row only). Policy names are `<table>_select_own`, `<table>_insert_own`, `<table>_update_own`, `<table>_delete_own`.
3. **`created_at timestamptz not null default now()`** on every table.
4. **`updated_at timestamptz not null default now()` + a `set_updated_at` trigger** ONLY on mutable-entity tables (tasks, habits, finance_accounts, training_sessions, journal_entries, integrations). Append-only tables (snapshots, logs, events, messages) omit it.
5. The shared trigger function `public.set_updated_at()` is defined ONCE in migration `20260527120001` and reused by later migrations (safe because `db push` applies in filename order).

The canonical RLS block for a table named `X`:

```sql
alter table public.X enable row level security;
create policy "X_select_own" on public.X for select using (auth.uid() = user_id);
create policy "X_insert_own" on public.X for insert with check (auth.uid() = user_id);
create policy "X_update_own" on public.X for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "X_delete_own" on public.X for delete using (auth.uid() = user_id);
```

---

## Task 1: Design system foundation (tokens + fonts + Tailwind mapping)

**Files:**
- Modify: `src/app/globals.css` (replace entirely)
- Modify: `src/app/layout.tsx` (add fonts)

This task is NOT internally parallelizable (both files are tightly coupled to the token system). It IS parallel-safe against all other Wave 1 tasks.

- [ ] **Step 1.1: Replace `src/app/globals.css`**

Replace the entire file with the following. This defines: dark tokens on `:root`, cream + warm overrides, the hearth type/space/radius/shadow/motion scales, and the Tailwind 4 `@theme` mapping that exposes them as utilities.

```css
@import "tailwindcss";

/* ============================================================
   PERSONAL OS — DESIGN TOKENS
   Dark is the default (:root). Cream and Warm are theme overrides.
   Sourced from design_handoff_personal_os/prototype/{hearth,app/app}.css
   ============================================================ */

:root {
  /* ---- Surfaces (dark) ---- */
  --os-bg:        #0E1014;
  --os-bg-2:      #14171C;
  --os-bg-3:      #1A1E24;
  --os-bg-hover:  #1F242B;
  --os-bg-sunk:   #0A0C10;

  /* ---- Foreground ---- */
  --os-fg-1:      #F2EEE6;
  --os-fg-2:      rgba(242, 238, 230, 0.72);
  --os-fg-3:      rgba(242, 238, 230, 0.52);
  --os-fg-4:      rgba(242, 238, 230, 0.36);
  --os-fg-5:      rgba(242, 238, 230, 0.20);

  /* ---- Hairlines ---- */
  --os-line-1:    rgba(242, 238, 230, 0.06);
  --os-line-2:    rgba(242, 238, 230, 0.10);
  --os-line-3:    rgba(242, 238, 230, 0.16);

  /* ---- Accent (sage) ---- */
  --os-accent:        #8FA67A;
  --os-accent-soft:   rgba(143, 166, 122, 0.14);
  --os-accent-glow:   rgba(143, 166, 122, 0.30);
  --os-accent-dim:    rgba(143, 166, 122, 0.55);

  /* ---- Secondary highlights ---- */
  --os-ember:         #E07856;
  --os-ember-soft:    rgba(224, 120, 86, 0.14);
  --os-honey:         #F4B860;
  --os-rust:          #C25D3F;
  --os-rust-soft:     rgba(194, 93, 63, 0.14);

  /* ---- Radii / grid ---- */
  --os-grid: 24px;
  --os-r-card: 14px;
  --os-r-inner: 10px;
  --os-r-pill: 999px;

  /* ---- Typography families (next/font vars set in layout.tsx) ---- */
  --font-display: var(--font-newsreader), "Iowan Old Style", Georgia, serif;
  --font-body:    var(--font-manrope), -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono:    var(--font-jetbrains-mono), ui-monospace, "SF Mono", Menlo, monospace;

  /* ---- Type scale ---- */
  --text-xs: 12px;  --text-sm: 13px;  --text-base: 15px; --text-md: 17px;
  --text-lg: 20px;  --text-xl: 24px;  --text-2xl: 32px;  --text-3xl: 44px;
  --text-4xl: 60px; --text-5xl: 84px;

  --leading-tight: 1.12; --leading-snug: 1.28; --leading-normal: 1.5; --leading-loose: 1.65;
  --tracking-tight: -0.02em; --tracking-snug: -0.01em; --tracking-normal: 0;
  --tracking-wide: 0.04em; --tracking-mega: 0.16em;

  /* ---- Spacing (4px grid) ---- */
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px;
  --s-8: 32px; --s-10: 40px; --s-12: 48px; --s-16: 64px; --s-20: 80px; --s-24: 96px;

  /* ---- Shadows (warm-tinted, never pure black) ---- */
  --shadow-sm: 0 1px 3px rgba(86, 56, 32, 0.06), 0 1px 2px rgba(86, 56, 32, 0.04);
  --shadow-md: 0 4px 12px rgba(86, 56, 32, 0.08), 0 2px 4px rgba(86, 56, 32, 0.04);
  --shadow-lg: 0 12px 32px rgba(86, 56, 32, 0.10), 0 4px 8px rgba(86, 56, 32, 0.05);
  --shadow-xl: 0 24px 48px rgba(86, 56, 32, 0.14), 0 8px 16px rgba(86, 56, 32, 0.06);

  /* ---- Motion ---- */
  --ease-standard: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-entrance: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 160ms; --dur-base: 220ms; --dur-slow: 360ms;
}

/* ---- Cream theme (daytime, hearth-faithful) ---- */
[data-theme="cream"] {
  --os-bg:        #F7F2E8;
  --os-bg-2:      #FFFCF6;
  --os-bg-3:      #FFFFFF;
  --os-bg-hover:  #ECE0CB;
  --os-bg-sunk:   #EDE2CE;

  --os-fg-1:      #1B1410;
  --os-fg-2:      rgba(27, 20, 16, 0.72);
  --os-fg-3:      rgba(27, 20, 16, 0.55);
  --os-fg-4:      rgba(27, 20, 16, 0.40);
  --os-fg-5:      rgba(27, 20, 16, 0.20);

  --os-line-1:    rgba(42, 31, 24, 0.06);
  --os-line-2:    rgba(42, 31, 24, 0.10);
  --os-line-3:    rgba(42, 31, 24, 0.18);

  --os-accent:        #5E7A4D;
  --os-accent-soft:   rgba(94, 122, 77, 0.10);
  --os-accent-glow:   rgba(94, 122, 77, 0.18);
  --os-accent-dim:    rgba(94, 122, 77, 0.55);
}

/* ---- Warm theme (evening, deep cocoa + ember) ---- */
[data-theme="warm"] {
  --os-bg:        #1A1410;
  --os-bg-2:      #221A14;
  --os-bg-3:      #29201A;
  --os-bg-hover:  #312721;
  --os-bg-sunk:   #120D0A;

  --os-fg-1:      #FAF1E1;
  --os-fg-2:      rgba(250, 241, 225, 0.74);
  --os-fg-3:      rgba(250, 241, 225, 0.50);
  --os-fg-4:      rgba(250, 241, 225, 0.34);
  --os-fg-5:      rgba(250, 241, 225, 0.18);

  --os-line-1:    rgba(250, 241, 225, 0.06);
  --os-line-2:    rgba(250, 241, 225, 0.11);
  --os-line-3:    rgba(250, 241, 225, 0.20);

  --os-accent:        #ED9569;
  --os-accent-soft:   rgba(237, 149, 105, 0.13);
  --os-accent-glow:   rgba(237, 149, 105, 0.30);
  --os-accent-dim:    rgba(237, 149, 105, 0.55);
}

/* ============================================================
   TAILWIND 4 @theme MAPPING
   Exposes tokens as utilities (bg-os-bg-2, text-os-fg-3, etc.).
   Values reference the CSS vars above so they resolve per theme.
   ============================================================ */
@theme inline {
  --color-os-bg: var(--os-bg);
  --color-os-bg-2: var(--os-bg-2);
  --color-os-bg-3: var(--os-bg-3);
  --color-os-bg-hover: var(--os-bg-hover);
  --color-os-bg-sunk: var(--os-bg-sunk);
  --color-os-fg-1: var(--os-fg-1);
  --color-os-fg-2: var(--os-fg-2);
  --color-os-fg-3: var(--os-fg-3);
  --color-os-fg-4: var(--os-fg-4);
  --color-os-fg-5: var(--os-fg-5);
  --color-os-line-1: var(--os-line-1);
  --color-os-line-2: var(--os-line-2);
  --color-os-line-3: var(--os-line-3);
  --color-os-accent: var(--os-accent);
  --color-os-ember: var(--os-ember);
  --color-os-honey: var(--os-honey);
  --color-os-rust: var(--os-rust);

  --font-display: var(--font-display);
  --font-body: var(--font-body);
  --font-mono: var(--font-mono);

  --radius-os-card: var(--os-r-card);
  --radius-os-inner: var(--os-r-inner);
  --radius-os-pill: var(--os-r-pill);
}

/* ---- Base ---- */
html, body {
  background-color: var(--os-bg);
  color: var(--os-fg-1);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

- [ ] **Step 1.2: Wire fonts in `src/app/layout.tsx`**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Newsreader, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Personal OS",
  description: "Max's personal operating system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${newsreader.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 1.3: Verify build**

```bash
cd "/Users/me/Projects/Personal OS"
pnpm tsc --noEmit   # expect exit 0
pnpm lint           # expect exit 0
PORT=3002 timeout 25 pnpm dev > /tmp/pos-dev-task1.log 2>&1 &
sleep 12
curl -s http://localhost:3002/login | grep -o 'data-theme="dark"' | head -1   # expect: data-theme="dark"
curl -s http://localhost:3002/login | grep -o "Sign in" | head -1             # expect: Sign in
pkill -f "next dev" 2>/dev/null
```

Expected: dev server boots, login page still renders with `data-theme="dark"`, no compile errors. If fonts cause a build error (e.g., Newsreader italic axis), report DONE_WITH_CONCERNS rather than guessing.

- [ ] **Step 1.4: Commit**

```bash
cd "/Users/me/Projects/Personal OS"
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: install full design-token system and three fonts

All ~70 OS tokens (dark/cream/warm palettes), hearth type/space/radius/
shadow/motion scales, and Tailwind 4 @theme mapping. Newsreader, Manrope,
JetBrains Mono loaded via next/font. Dark remains the default theme."
```

---

## Task 2: Display callback error on login page (deferred from 1A.1)

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

The callback route (`/callback`) redirects failures to `/login?error=...`, but the login page never reads that param. This adds the display.

- [ ] **Step 2.1: Add searchParams error reading to the login page**

The login page is a client component. Add `useSearchParams` from `next/navigation` to read the `error` query param and show it.

**CRITICAL — Suspense boundary required.** In Next.js 16, any client component calling `useSearchParams()` MUST have that call inside a `<Suspense>` boundary, or `next build` (and therefore Vercel deployment) fails with `useSearchParams() should be wrapped in a suspense boundary`. Dev mode and Playwright do NOT catch this. The fix is structural: extract the form into an inner `LoginForm` component (which calls `useSearchParams`) and wrap it in `<Suspense>` from the default export. The replacement below already does this — do not flatten it back into a single component.

Replace the file with:

```tsx
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }

    setStatus("sent");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--os-fg-3)]">
            MAX OS · V0
          </div>
          <h1 className="text-2xl mt-2 font-[family-name:var(--font-display)]">Sign in</h1>
          <p className="text-sm text-[color:var(--os-fg-3)] mt-1">
            Magic link to your inbox.
          </p>
        </div>

        {callbackError && status !== "sent" && (
          <div className="mb-4 text-xs text-[color:var(--os-rust)]">
            {callbackError === "missing_code"
              ? "That sign-in link was incomplete. Try again."
              : callbackError === "server_error"
                ? "Something went wrong completing sign-in. Try again."
                : decodeURIComponent(callbackError)}
          </div>
        )}

        {status === "sent" ? (
          <div className="text-sm text-[color:var(--os-accent)]">
            ✓ Magic link sent. Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 bg-[color:var(--os-bg-2)] border border-[color:var(--os-line-2)] rounded-[10px] text-sm focus:outline-none focus:border-[color:var(--os-accent)]"
              disabled={status === "sending"}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full py-2 bg-[color:var(--os-accent)] text-[color:var(--os-bg)] rounded-[10px] text-sm font-medium disabled:opacity-50"
            >
              {status === "sending" ? "Sending..." : "Send magic link"}
            </button>
            {status === "error" && (
              <div className="text-xs text-[color:var(--os-rust)]">{errorMsg}</div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
```

Note two changes beyond the error display: the `Sign in` heading now uses the display (serif) font via `font-[family-name:var(--font-display)]`, and the error text color is now `var(--os-rust)` instead of `text-red-400` (consistent with the design system). Both are intentional improvements enabled by Task 1's tokens — but Task 1 and Task 2 run in parallel, so the `--os-rust` / `--font-display` vars may not exist yet at the moment this file is written. That's fine: CSS variables that resolve to nothing degrade gracefully (text just inherits color / default font) until Task 1's commit lands. Do NOT add a dependency on Task 1.

- [ ] **Step 2.2: Verify**

```bash
cd "/Users/me/Projects/Personal OS"
pnpm tsc --noEmit   # expect exit 0
pnpm lint           # expect exit 0
pnpm build          # expect exit 0 — THIS is what catches a missing Suspense boundary
```

The `pnpm build` step is mandatory here (not just tsc+lint) because the Suspense-boundary requirement for `useSearchParams()` only surfaces during a production build, which is exactly what Vercel runs. If `pnpm build` fails with `useSearchParams() should be wrapped in a suspense boundary`, the `<Suspense>` wrapper in Step 2.1 was not applied correctly — fix it before committing. A passing `pnpm build` here means the deploy will not break on this.

- [ ] **Step 2.3: Commit**

```bash
cd "/Users/me/Projects/Personal OS"
git add 'src/app/(auth)/login/page.tsx'
git commit -m "fix: surface callback errors on login page

Reads the ?error= query param the callback route redirects with and shows
a friendly message. Addresses Plan 1A.1 final-review finding. Also moves the
heading to the display font and error color to --os-rust."
```

---

## Task 3: Remove unused scaffold SVGs (deferred from 1A.1)

**Files:**
- Delete: `public/next.svg`, `public/vercel.svg`, `public/file.svg`, `public/globe.svg`, `public/window.svg`

- [ ] **Step 3.1: Confirm no references exist**

```bash
cd "/Users/me/Projects/Personal OS"
grep -rn "next.svg\|vercel.svg\|file.svg\|globe.svg\|window.svg" src/ 2>/dev/null
```

Expected: NO output (these were only referenced by the old scaffold `page.tsx`, replaced in Plan 1A.1). If any reference appears, STOP and report — do not delete a referenced asset.

- [ ] **Step 3.2: Delete the files**

```bash
cd "/Users/me/Projects/Personal OS"
git rm public/next.svg public/vercel.svg public/file.svg public/globe.svg public/window.svg
```

- [ ] **Step 3.3: Verify build still clean**

```bash
cd "/Users/me/Projects/Personal OS"
pnpm tsc --noEmit   # expect exit 0
pnpm lint           # expect exit 0
```

- [ ] **Step 3.4: Commit**

```bash
cd "/Users/me/Projects/Personal OS"
git commit -m "chore: remove unused create-next-app scaffold SVGs

Five default SVGs in public/ had no references after Plan 1A.1 replaced the
scaffold page. Removing dead deploy weight. Addresses 1A.1 final-review finding."
```

---

## Task 4: Migration — integrations + agent_messages + shared trigger

**Files:**
- Create: `supabase/migrations/20260527120001_create_integrations_and_agent_messages.sql`

This migration also defines the shared `set_updated_at()` trigger function reused by later migrations.

- [ ] **Step 4.1: Create the migration file** with exactly:

```sql
-- Shared updated_at trigger function (reused by later migrations)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---- integrations: connection state per external provider ----
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  status text not null default 'connected' check (status in ('connected','expired','error')),
  access_token text,
  refresh_token text,
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.integrations enable row level security;
create policy "integrations_select_own" on public.integrations for select using (auth.uid() = user_id);
create policy "integrations_insert_own" on public.integrations for insert with check (auth.uid() = user_id);
create policy "integrations_update_own" on public.integrations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "integrations_delete_own" on public.integrations for delete using (auth.uid() = user_id);

create trigger integrations_set_updated_at before update on public.integrations
  for each row execute function public.set_updated_at();

-- ---- agent_messages: single conversation thread across channels (Phase 2) ----
create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('you','agent')),
  source text not null check (source in ('TELEGRAM','WEB_CAPTURE','MOBILE_CAPTURE','MAX_OS')),
  text text not null default '',
  chips jsonb not null default '[]'::jsonb,
  tool_calls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_messages enable row level security;
create policy "agent_messages_select_own" on public.agent_messages for select using (auth.uid() = user_id);
create policy "agent_messages_insert_own" on public.agent_messages for insert with check (auth.uid() = user_id);
create policy "agent_messages_update_own" on public.agent_messages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "agent_messages_delete_own" on public.agent_messages for delete using (auth.uid() = user_id);

create index agent_messages_user_created_idx on public.agent_messages (user_id, created_at desc);
```

- [ ] **Step 4.2: Verify the SQL file is syntactically well-formed** (do NOT apply yet — Task 17 applies all migrations):

```bash
cd "/Users/me/Projects/Personal OS"
test -f supabase/migrations/20260527120001_create_integrations_and_agent_messages.sql && echo "file exists"
```

- [ ] **Step 4.3: Commit**

```bash
cd "/Users/me/Projects/Personal OS"
git add supabase/migrations/20260527120001_create_integrations_and_agent_messages.sql
git commit -m "feat: add integrations and agent_messages tables (migration)"
```

---

## Task 5: Migration — tasks

**Files:**
- Create: `supabase/migrations/20260527120002_create_tasks.sql`

- [ ] **Step 5.1: Create the file** with exactly:

```sql
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  tags text[] not null default '{}',
  star boolean not null default false,
  done boolean not null default false,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
create policy "tasks_select_own" on public.tasks for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks for delete using (auth.uid() = user_id);

create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

create index tasks_user_done_idx on public.tasks (user_id, done);
create index tasks_user_due_idx on public.tasks (user_id, due_at);
```

- [ ] **Step 5.2: Confirm file exists**, then **commit**:

```bash
cd "/Users/me/Projects/Personal OS"
test -f supabase/migrations/20260527120002_create_tasks.sql && echo "ok"
git add supabase/migrations/20260527120002_create_tasks.sql
git commit -m "feat: add tasks table (migration)"
```

---

## Task 6: Migration — habits + habit_logs

**Files:**
- Create: `supabase/migrations/20260527120003_create_habits.sql`

- [ ] **Step 6.1: Create the file** with exactly:

```sql
-- habit definitions
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sub_label text not null default '',
  position integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.habits enable row level security;
create policy "habits_select_own" on public.habits for select using (auth.uid() = user_id);
create policy "habits_insert_own" on public.habits for insert with check (auth.uid() = user_id);
create policy "habits_update_own" on public.habits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits_delete_own" on public.habits for delete using (auth.uid() = user_id);

create trigger habits_set_updated_at before update on public.habits
  for each row execute function public.set_updated_at();

-- one row per habit per day
create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  date date not null,
  done boolean not null default true,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

alter table public.habit_logs enable row level security;
create policy "habit_logs_select_own" on public.habit_logs for select using (auth.uid() = user_id);
create policy "habit_logs_insert_own" on public.habit_logs for insert with check (auth.uid() = user_id);
create policy "habit_logs_update_own" on public.habit_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habit_logs_delete_own" on public.habit_logs for delete using (auth.uid() = user_id);

create index habit_logs_user_date_idx on public.habit_logs (user_id, date);
```

- [ ] **Step 6.2: Confirm + commit**:

```bash
cd "/Users/me/Projects/Personal OS"
test -f supabase/migrations/20260527120003_create_habits.sql && echo "ok"
git add supabase/migrations/20260527120003_create_habits.sql
git commit -m "feat: add habits and habit_logs tables (migration)"
```

---

## Task 7: Migration — calendar_events

**Files:**
- Create: `supabase/migrations/20260527120004_create_calendar_events.sql`

- [ ] **Step 7.1: Create the file** with exactly:

```sql
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  sub text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  external_id text,
  source text not null default 'manual' check (source in ('manual','google_calendar')),
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table public.calendar_events enable row level security;
create policy "calendar_events_select_own" on public.calendar_events for select using (auth.uid() = user_id);
create policy "calendar_events_insert_own" on public.calendar_events for insert with check (auth.uid() = user_id);
create policy "calendar_events_update_own" on public.calendar_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "calendar_events_delete_own" on public.calendar_events for delete using (auth.uid() = user_id);

create index calendar_events_user_starts_idx on public.calendar_events (user_id, starts_at);
```

- [ ] **Step 7.2: Confirm + commit**:

```bash
cd "/Users/me/Projects/Personal OS"
test -f supabase/migrations/20260527120004_create_calendar_events.sql && echo "ok"
git add supabase/migrations/20260527120004_create_calendar_events.sql
git commit -m "feat: add calendar_events table (migration)"
```

---

## Task 8: Migration — finance_accounts + finance_snapshots

**Files:**
- Create: `supabase/migrations/20260527120005_create_finance.sql`

- [ ] **Step 8.1: Create the file** with exactly:

```sql
create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('BANK','HYSA','EQUITY','RETIRE','CRYPTO','PRIVATE','T_BILLS')),
  current_value numeric(18,2) not null default 0,
  plaid_account_id text,
  source text not null default 'manual' check (source in ('manual','plaid','coinbase')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_accounts enable row level security;
create policy "finance_accounts_select_own" on public.finance_accounts for select using (auth.uid() = user_id);
create policy "finance_accounts_insert_own" on public.finance_accounts for insert with check (auth.uid() = user_id);
create policy "finance_accounts_update_own" on public.finance_accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "finance_accounts_delete_own" on public.finance_accounts for delete using (auth.uid() = user_id);

create trigger finance_accounts_set_updated_at before update on public.finance_accounts
  for each row execute function public.set_updated_at();

-- one snapshot per account per day for the sparkline
create table public.finance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.finance_accounts(id) on delete cascade,
  date date not null,
  value numeric(18,2) not null,
  created_at timestamptz not null default now(),
  unique (account_id, date)
);

alter table public.finance_snapshots enable row level security;
create policy "finance_snapshots_select_own" on public.finance_snapshots for select using (auth.uid() = user_id);
create policy "finance_snapshots_insert_own" on public.finance_snapshots for insert with check (auth.uid() = user_id);
create policy "finance_snapshots_update_own" on public.finance_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "finance_snapshots_delete_own" on public.finance_snapshots for delete using (auth.uid() = user_id);

create index finance_snapshots_user_date_idx on public.finance_snapshots (user_id, date);
```

- [ ] **Step 8.2: Confirm + commit**:

```bash
cd "/Users/me/Projects/Personal OS"
test -f supabase/migrations/20260527120005_create_finance.sql && echo "ok"
git add supabase/migrations/20260527120005_create_finance.sql
git commit -m "feat: add finance_accounts and finance_snapshots tables (migration)"
```

---

## Task 9: Migration — nutrition_entries

**Files:**
- Create: `supabase/migrations/20260527120006_create_nutrition.sql`

- [ ] **Step 9.1: Create the file** with exactly:

```sql
create table public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  kcal integer not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  eaten_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','agent')),
  created_at timestamptz not null default now()
);

alter table public.nutrition_entries enable row level security;
create policy "nutrition_entries_select_own" on public.nutrition_entries for select using (auth.uid() = user_id);
create policy "nutrition_entries_insert_own" on public.nutrition_entries for insert with check (auth.uid() = user_id);
create policy "nutrition_entries_update_own" on public.nutrition_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nutrition_entries_delete_own" on public.nutrition_entries for delete using (auth.uid() = user_id);

create index nutrition_entries_user_eaten_idx on public.nutrition_entries (user_id, eaten_at);
```

- [ ] **Step 9.2: Confirm + commit**:

```bash
cd "/Users/me/Projects/Personal OS"
test -f supabase/migrations/20260527120006_create_nutrition.sql && echo "ok"
git add supabase/migrations/20260527120006_create_nutrition.sql
git commit -m "feat: add nutrition_entries table (migration)"
```

---

## Task 10: Migration — health_snapshots

**Files:**
- Create: `supabase/migrations/20260527120007_create_health_snapshots.sql`

- [ ] **Step 10.1: Create the file** with exactly:

```sql
-- one row per day; source-priority resolved at write time via upsert on (user_id, date)
create table public.health_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep_score integer,
  sleep_hours numeric(4,1),
  recovery_score integer,
  strain numeric(4,1),
  hrv integer,
  rhr integer,
  weight numeric(6,2),
  weight_unit text not null default 'lbs' check (weight_unit in ('lbs','kg')),
  steps integer,
  vo2_max numeric(4,1),
  source text not null default 'manual' check (source in ('manual','whoop','apple_health','oura')),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.health_snapshots enable row level security;
create policy "health_snapshots_select_own" on public.health_snapshots for select using (auth.uid() = user_id);
create policy "health_snapshots_insert_own" on public.health_snapshots for insert with check (auth.uid() = user_id);
create policy "health_snapshots_update_own" on public.health_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "health_snapshots_delete_own" on public.health_snapshots for delete using (auth.uid() = user_id);

create index health_snapshots_user_date_idx on public.health_snapshots (user_id, date);
```

- [ ] **Step 10.2: Confirm + commit**:

```bash
cd "/Users/me/Projects/Personal OS"
test -f supabase/migrations/20260527120007_create_health_snapshots.sql && echo "ok"
git add supabase/migrations/20260527120007_create_health_snapshots.sql
git commit -m "feat: add health_snapshots table (migration)"
```

---

## Task 11: Migration — social_followers

**Files:**
- Create: `supabase/migrations/20260527120008_create_social_followers.sql`

- [ ] **Step 11.1: Create the file** with exactly:

```sql
-- one row per platform per day
create table public.social_followers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('X','LINKEDIN','SUBSTACK','GITHUB','IG')),
  date date not null,
  count integer not null default 0,
  source text not null default 'manual' check (source in ('manual','github','api')),
  created_at timestamptz not null default now(),
  unique (user_id, platform, date)
);

alter table public.social_followers enable row level security;
create policy "social_followers_select_own" on public.social_followers for select using (auth.uid() = user_id);
create policy "social_followers_insert_own" on public.social_followers for insert with check (auth.uid() = user_id);
create policy "social_followers_update_own" on public.social_followers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "social_followers_delete_own" on public.social_followers for delete using (auth.uid() = user_id);

create index social_followers_user_platform_date_idx on public.social_followers (user_id, platform, date);
```

- [ ] **Step 11.2: Confirm + commit**:

```bash
cd "/Users/me/Projects/Personal OS"
test -f supabase/migrations/20260527120008_create_social_followers.sql && echo "ok"
git add supabase/migrations/20260527120008_create_social_followers.sql
git commit -m "feat: add social_followers table (migration)"
```

---

## Task 12: Migration — training_sessions + lifts

**Files:**
- Create: `supabase/migrations/20260527120009_create_training.sql`

- [ ] **Step 12.1: Create the file** with exactly:

```sql
create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  split_name text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.training_sessions enable row level security;
create policy "training_sessions_select_own" on public.training_sessions for select using (auth.uid() = user_id);
create policy "training_sessions_insert_own" on public.training_sessions for insert with check (auth.uid() = user_id);
create policy "training_sessions_update_own" on public.training_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "training_sessions_delete_own" on public.training_sessions for delete using (auth.uid() = user_id);

create trigger training_sessions_set_updated_at before update on public.training_sessions
  for each row execute function public.set_updated_at();

create table public.lifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  name text not null,
  weight numeric(7,2) not null default 0,
  weight_unit text not null default 'lbs' check (weight_unit in ('lbs','kg')),
  reps integer not null default 0,
  sets integer not null default 1,
  is_pr boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.lifts enable row level security;
create policy "lifts_select_own" on public.lifts for select using (auth.uid() = user_id);
create policy "lifts_insert_own" on public.lifts for insert with check (auth.uid() = user_id);
create policy "lifts_update_own" on public.lifts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lifts_delete_own" on public.lifts for delete using (auth.uid() = user_id);

create index lifts_session_idx on public.lifts (session_id);
```

- [ ] **Step 12.2: Confirm + commit**:

```bash
cd "/Users/me/Projects/Personal OS"
test -f supabase/migrations/20260527120009_create_training.sql && echo "ok"
git add supabase/migrations/20260527120009_create_training.sql
git commit -m "feat: add training_sessions and lifts tables (migration)"
```

---

## Task 13: Migration — journal_entries

**Files:**
- Create: `supabase/migrations/20260527120010_create_journal_entries.sql`

- [ ] **Step 13.1: Create the file** with exactly:

```sql
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  tags text[] not null default '{}',
  mentions jsonb not null default '[]'::jsonb,
  written_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.journal_entries enable row level security;
create policy "journal_entries_select_own" on public.journal_entries for select using (auth.uid() = user_id);
create policy "journal_entries_insert_own" on public.journal_entries for insert with check (auth.uid() = user_id);
create policy "journal_entries_update_own" on public.journal_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "journal_entries_delete_own" on public.journal_entries for delete using (auth.uid() = user_id);

create trigger journal_entries_set_updated_at before update on public.journal_entries
  for each row execute function public.set_updated_at();

create index journal_entries_user_written_idx on public.journal_entries (user_id, written_at desc);
```

- [ ] **Step 13.2: Confirm + commit**:

```bash
cd "/Users/me/Projects/Personal OS"
test -f supabase/migrations/20260527120010_create_journal_entries.sql && echo "ok"
git add supabase/migrations/20260527120010_create_journal_entries.sql
git commit -m "feat: add journal_entries table (migration)"
```

---

## Task 14: Migration — gmail_threads

**Files:**
- Create: `supabase/migrations/20260527120011_create_gmail_threads.sql`

- [ ] **Step 14.1: Create the file** with exactly:

```sql
create table public.gmail_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_id text not null,
  sender_name text not null default '',
  sender_email text not null default '',
  subject text not null default '',
  snippet text not null default '',
  received_at timestamptz not null,
  is_unread boolean not null default true,
  is_important boolean not null default false,
  labels text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, gmail_id)
);

alter table public.gmail_threads enable row level security;
create policy "gmail_threads_select_own" on public.gmail_threads for select using (auth.uid() = user_id);
create policy "gmail_threads_insert_own" on public.gmail_threads for insert with check (auth.uid() = user_id);
create policy "gmail_threads_update_own" on public.gmail_threads for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gmail_threads_delete_own" on public.gmail_threads for delete using (auth.uid() = user_id);

create index gmail_threads_user_received_idx on public.gmail_threads (user_id, received_at desc);
```

- [ ] **Step 14.2: Confirm + commit**:

```bash
cd "/Users/me/Projects/Personal OS"
test -f supabase/migrations/20260527120011_create_gmail_threads.sql && echo "ok"
git add supabase/migrations/20260527120011_create_gmail_threads.sql
git commit -m "feat: add gmail_threads table (migration)"
```

---

## Task 15: Migration — observability (sync_runs + error_events)

**Files:**
- Create: `supabase/migrations/20260527120012_create_observability.sql`

- [ ] **Step 15.1: Create the file** with exactly:

```sql
-- per-integration sync log
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_synced integer not null default 0,
  status text not null default 'ok' check (status in ('ok','partial','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.sync_runs enable row level security;
create policy "sync_runs_select_own" on public.sync_runs for select using (auth.uid() = user_id);
create policy "sync_runs_insert_own" on public.sync_runs for insert with check (auth.uid() = user_id);
create policy "sync_runs_update_own" on public.sync_runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sync_runs_delete_own" on public.sync_runs for delete using (auth.uid() = user_id);

create index sync_runs_user_provider_started_idx on public.sync_runs (user_id, provider, started_at desc);

-- server-action exception log
create table public.error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text,
  severity text not null default 'error' check (severity in ('info','warn','error')),
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.error_events enable row level security;
create policy "error_events_select_own" on public.error_events for select using (auth.uid() = user_id);
create policy "error_events_insert_own" on public.error_events for insert with check (auth.uid() = user_id);
create policy "error_events_update_own" on public.error_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "error_events_delete_own" on public.error_events for delete using (auth.uid() = user_id);

create index error_events_user_created_idx on public.error_events (user_id, created_at desc);
```

- [ ] **Step 15.2: Confirm + commit**:

```bash
cd "/Users/me/Projects/Personal OS"
test -f supabase/migrations/20260527120012_create_observability.sql && echo "ok"
git add supabase/migrations/20260527120012_create_observability.sql
git commit -m "feat: add sync_runs and error_events tables (migration)"
```

---

## Task 16: Token swatch verification page (Wave 2 — needs Task 1)

**Files:**
- Create: `src/app/dev/tokens/page.tsx`

A simple page that renders swatches of every color token + the type scale, so design fidelity is visually verifiable. Lives under `/dev/` (not linked from anywhere). Note: middleware will redirect unauthenticated access to `/login` — that's fine, sign in first to view it.

- [ ] **Step 16.1: Create the swatch page**:

```tsx
const COLOR_TOKENS = [
  "--os-bg", "--os-bg-2", "--os-bg-3", "--os-bg-hover", "--os-bg-sunk",
  "--os-fg-1", "--os-fg-2", "--os-fg-3", "--os-fg-4", "--os-fg-5",
  "--os-line-1", "--os-line-2", "--os-line-3",
  "--os-accent", "--os-accent-soft", "--os-accent-glow", "--os-accent-dim",
  "--os-ember", "--os-honey", "--os-rust",
];

const TYPE_SCALE = [
  { name: "text-5xl", size: "84px" },
  { name: "text-3xl", size: "44px" },
  { name: "text-2xl", size: "32px" },
  { name: "text-xl", size: "24px" },
  { name: "text-lg", size: "20px" },
  { name: "text-base", size: "15px" },
  { name: "text-sm", size: "13px" },
  { name: "text-xs", size: "12px" },
];

export default function TokensPage() {
  return (
    <main className="min-h-screen p-8 space-y-10">
      <div>
        <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--os-fg-3)]">
          DEV · DESIGN TOKENS
        </div>
        <h1 className="text-2xl mt-2 font-[family-name:var(--font-display)]">
          Token swatches
        </h1>
        <p className="text-sm text-[color:var(--os-fg-3)] mt-1">
          Switch themes by setting <code className="font-mono">data-theme</code> on
          {" "}<code className="font-mono">&lt;html&gt;</code> to cream or warm.
        </p>
      </div>

      <section>
        <h2 className="text-xs tracking-[0.16em] uppercase text-[color:var(--os-fg-4)] mb-3">
          Color
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {COLOR_TOKENS.map((token) => (
            <div key={token} className="rounded-[10px] border border-[color:var(--os-line-2)] overflow-hidden">
              <div className="h-16" style={{ background: `var(${token})` }} />
              <div className="p-2 text-[11px] font-mono text-[color:var(--os-fg-3)]">{token}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs tracking-[0.16em] uppercase text-[color:var(--os-fg-4)] mb-3">
          Type scale
        </h2>
        <div className="space-y-2">
          {TYPE_SCALE.map((t) => (
            <div key={t.name} style={{ fontSize: t.size }} className="font-[family-name:var(--font-display)] leading-tight">
              {t.name} — The hub for my life
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs tracking-[0.16em] uppercase text-[color:var(--os-fg-4)] mb-3">
          Font families
        </h2>
        <div className="space-y-2 text-lg">
          <p className="font-[family-name:var(--font-display)]">Newsreader — editorial serif display</p>
          <p className="font-[family-name:var(--font-body)]">Manrope — humanist sans body</p>
          <p className="font-[family-name:var(--font-mono)]">JetBrains Mono — 1234567890</p>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 16.2: Verify**:

```bash
cd "/Users/me/Projects/Personal OS"
pnpm tsc --noEmit   # expect exit 0
pnpm lint           # expect exit 0
```

- [ ] **Step 16.3: Commit**:

```bash
cd "/Users/me/Projects/Personal OS"
git add 'src/app/dev/tokens/page.tsx'
git commit -m "feat: add /dev/tokens swatch page for design-token verification"
```

---

## Task 17: Apply all migrations + generate TypeScript types (Wave 2 — needs Tasks 4–15)

**Files:**
- Create: `src/lib/supabase/database.types.ts`
- Modify: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`

This task applies the 12 migration files to the remote Supabase project and wires generated types into the client helpers. It MUST run after all of Tasks 4–15 are committed.

- [ ] **Step 17.1: Apply all pending migrations**:

```bash
cd "/Users/me/Projects/Personal OS"
pnpm supabase db push
```

Expected: applies all 12 new migrations (`20260527120001` … `20260527120012`) in order. If prompted to confirm, type `y`. If `db push` prompts for a DB password you don't have, STOP and report NEEDS_CONTEXT (Plan 1A.1 linked the project with cached credentials, so this likely won't prompt).

- [ ] **Step 17.2: Verify all tables applied**:

```bash
cd "/Users/me/Projects/Personal OS"
pnpm supabase migration list
```

Expected: every migration `20260527120001`–`20260527120012` shows a timestamp in BOTH the Local and Remote columns. If any is missing from Remote, the push failed — report it with the error.

- [ ] **Step 17.3: Generate TypeScript types from the remote schema**:

```bash
cd "/Users/me/Projects/Personal OS"
pnpm supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

Expected: `src/lib/supabase/database.types.ts` is created with a `Database` type containing all tables (profiles, integrations, agent_messages, tasks, habits, habit_logs, calendar_events, finance_accounts, finance_snapshots, nutrition_entries, health_snapshots, social_followers, training_sessions, lifts, journal_entries, gmail_threads, sync_runs, error_events). Open the file and confirm `tasks` and `health_snapshots` appear in it.

- [ ] **Step 17.4: Type the three client helpers with `Database`**

In each of the three files, import the generated type and parameterize the client factory.

`src/lib/supabase/client.ts` — change the import block and the factory call:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

`src/lib/supabase/server.ts` — add the import and parameterize `createServerClient<Database>(...)` (keep the rest of the cookie adapter unchanged):

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component context — cookies can't be set. Middleware handles refresh.
          }
        },
      },
    },
  );
}
```

`src/lib/supabase/middleware.ts` — add the import and parameterize `createServerClient<Database>(...)` (keep the rest unchanged):

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
```
and change `createServerClient(` to `createServerClient<Database>(` in that file.

- [ ] **Step 17.5: Verify**:

```bash
cd "/Users/me/Projects/Personal OS"
pnpm tsc --noEmit   # expect exit 0
pnpm lint           # expect exit 0
```

- [ ] **Step 17.6: Commit**:

```bash
cd "/Users/me/Projects/Personal OS"
git add src/lib/supabase/database.types.ts src/lib/supabase/client.ts src/lib/supabase/server.ts src/lib/supabase/middleware.ts
git commit -m "feat: apply 15-table schema and wire generated DB types into clients

Applied 12 migrations (integrations, agent_messages, tasks, habits/logs,
calendar, finance, nutrition, health, social, training/lifts, journal,
gmail, observability). Generated database.types.ts from remote and
parameterized all three Supabase clients with the Database type."
```

---

## Task 18: Acceptance gate walkthrough (Wave 3)

@superpowers:verification-before-completion applies — verify by running, not by assuming.

- [ ] **Step 18.1: Full build + type + lint + test pass**:

```bash
cd "/Users/me/Projects/Personal OS"
pnpm tsc --noEmit                                   # expect exit 0
pnpm lint                                           # expect exit 0
pnpm build                                          # expect exit 0 — catches build-only errors (Suspense, etc.) that dev/Playwright miss
PORT=3002 BASE_URL=http://localhost:3002 pnpm exec playwright test --reporter=line   # expect 3 passed
```

- [ ] **Step 18.2: Verify tables exist on remote**:

```bash
cd "/Users/me/Projects/Personal OS"
pnpm supabase migration list   # all 20260527120001-120012 present Local + Remote
```

- [ ] **Step 18.3: Visual token check** (manual, requires sign-in):

Start dev (`PORT=3002 pnpm dev`), sign in, visit `http://localhost:3002/dev/tokens`. Confirm: color swatches render, type scale shows Newsreader serif, three font families visibly differ. Report what you see. (Pauses for human confirmation.)

- [ ] **Step 18.4: Confirm scaffold SVGs are gone**:

```bash
cd "/Users/me/Projects/Personal OS"
ls public/*.svg 2>/dev/null && echo "SVGs still present (FAIL)" || echo "OK: no scaffold SVGs"
```

- [ ] **Step 18.5: Clean git log review**:

```bash
cd "/Users/me/Projects/Personal OS"
git log --oneline -18
```

Expected: ~17 new commits, all conventional-commit prefixed.

---

## Definition of Done for Plan 1A.2

1. `globals.css` holds all three theme palettes + hearth scales + Tailwind `@theme` mapping
2. Three fonts (Newsreader, Manrope, JetBrains Mono) load via `next/font`; `/dev/tokens` shows them rendering
3. Login page displays callback `?error=` messages
4. Five scaffold SVGs removed from `public/`
5. All 12 new migrations applied to remote (17 tables: integrations, agent_messages, tasks, habits, habit_logs, calendar_events, finance_accounts, finance_snapshots, nutrition_entries, health_snapshots, social_followers, training_sessions, lifts, journal_entries, gmail_threads, sync_runs, error_events) — each with RLS + own-row policies
6. `database.types.ts` generated; all three Supabase clients typed with `Database`
7. `pnpm tsc --noEmit` → 0 errors; `pnpm lint` → 0 errors
8. All 3 Playwright tests still pass
9. `/dev/tokens` renders all color swatches + type scale + font families
10. Clean conventional-commit git history

**On completion:** Plan 1A.3 builds the layout shells (web 3-zone + mobile single-column + viewport switching + TopBar with live clock) on top of this design system and data layer.
