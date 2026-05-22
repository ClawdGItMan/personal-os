# Personal OS — Plan 1A.1: First Sign-In

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js app, wire Supabase auth (magic link), and verify end-to-end sign-in to a placeholder dashboard with dark theme tokens applied.

**Architecture:** Next.js 14+ App Router scaffolded at the repo root. TypeScript strict mode. Tailwind CSS with a minimal subset of the design tokens (full token system arrives in Plan 1A.2). Supabase Auth via `@supabase/ssr` for magic-link flow. Two routes initially: `/(auth)/login` and `/(app)/dashboard`. Middleware enforces auth.

**Tech Stack:** Next.js 14+, TypeScript, Tailwind CSS, Supabase (Auth only for this plan), pnpm, Vitest, Playwright

**Spec reference:** `docs/superpowers/specs/2026-05-21-personal-os-design.md` — Section 5.1 (Routing), Section 5.3 (Theme), Section 7 Phase 1A acceptance gate (partial)

**Out of scope for this plan** (covered later in Phase 1A):
- The other 13 database tables (this plan only creates `profiles`)
- Full design token system (only dark-theme bg/fg variables for now)
- Layout shells (web 3-zone, mobile single-column) — Plan 1A.3
- shadcn/ui initialization — Plan 1A.3
- PWA manifest, icons, splash — Plan 1A.last
- Any module rendering

---

## Prerequisites (manual, user-performed before agent execution)

These steps require human action outside of the agent's tools. **The executing agent must verify each of these is done before starting Task 1.**

- [ ] **Install pnpm globally**: `npm install -g pnpm` (or use existing pnpm install)
- [ ] **Install Vercel CLI**: `npm install -g vercel` — needed throughout build; flagged by session-start hook
- [ ] **Create Supabase project**: visit https://supabase.com/dashboard → New Project → name "personal-os" → choose region (US East for NYC operator) → set strong DB password → wait for provisioning
- [ ] **Capture Supabase credentials**: Project Settings → API → copy `Project URL` and `anon public key`. Store securely for env var step
- [ ] **Verify Node.js version**: `node --version` returns ≥20.0.0 (Next.js 14 requirement)

---

## File Structure (after this plan)

```
/Users/me/Projects/Personal OS/
├── .env.local                              [gitignored, holds Supabase creds]
├── .env.example                            [committed, no real values]
├── .gitignore                              [existing, may extend]
├── .vercelignore                           [new, excludes design_handoff_personal_os]
├── package.json                            [new]
├── pnpm-lock.yaml                          [new]
├── next.config.mjs                         [new]
├── tsconfig.json                           [new]
├── tailwind.config.ts                      [new]
├── postcss.config.mjs                      [new]
├── middleware.ts                           [new — auth redirect]
├── src/
│   ├── app/
│   │   ├── layout.tsx                      [new — html lang, data-theme="dark"]
│   │   ├── globals.css                     [new — minimal dark tokens, Tailwind directives]
│   │   ├── page.tsx                        [new — redirects to /dashboard or /login]
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx              [new — magic link form]
│   │   │   └── callback/route.ts           [new — auth callback handler]
│   │   └── (app)/
│   │       └── dashboard/page.tsx          [new — placeholder "Hello, {email}"]
│   └── lib/
│       └── supabase/
│           ├── client.ts                   [new — browser client]
│           ├── server.ts                   [new — server client]
│           └── middleware.ts               [new — middleware client helper]
├── supabase/
│   ├── config.toml                         [new — supabase init]
│   └── migrations/
│       └── 20260521000001_create_profiles.sql [new — profiles table + RLS]
├── tests/
│   └── e2e/
│       └── first-signin.spec.ts            [new — Playwright E2E]
├── playwright.config.ts                    [new]
├── vitest.config.ts                        [new]
├── docs/                                   [existing]
└── design_handoff_personal_os/             [existing]
```

---

## Task 1: Scaffold Next.js

**Files:**
- Create: `package.json`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1.1: Run create-next-app**

Run in `/Users/me/Projects/Personal OS/`:
```bash
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-turbopack
```

**Known snags to expect:**
- The `--no-turbopack` flag may not exist on your create-next-app version. If you see "unknown option," drop the flag and answer "No" to the Turbopack prompt.
- The directory is non-empty (contains `docs/`, `design_handoff_personal_os/`, `.git/`). create-next-app may print a non-empty-directory warning and either prompt or refuse. If it refuses outright, the fallback is: scaffold to a temp directory (e.g., `/tmp/next-scaffold`), then move the generated files into `/Users/me/Projects/Personal OS/` (move everything except the temp dir's `.git/`).
- When prompted "Would you like to use Turbopack" → No (default Webpack is fine for now).
- When prompted about existing files → Yes, continue.

Expected outcome: Next.js scaffolded in current dir; `package.json`, `src/app/`, `next.config.mjs` etc. created.

- [ ] **Step 1.2: Verify scaffold works**

Run: `pnpm dev`

Expected: dev server starts on http://localhost:3000, default Next.js welcome page renders. Stop server with Ctrl-C.

- [ ] **Step 1.3: Enable TypeScript strict mode**

Open `tsconfig.json`. Verify (or set) `"strict": true` in `compilerOptions`. Also add: `"noUncheckedIndexedAccess": true` and `"forceConsistentCasingInFileNames": true`.

Run `pnpm tsc --noEmit` — expect zero errors.

- [ ] **Step 1.4: Commit scaffold**

```bash
git add .
git commit -m "feat: scaffold Next.js 14 app with TS, Tailwind, App Router

Initialized via create-next-app with --src-dir, strict TS, Tailwind,
ESLint, pnpm. Foundation for Plan 1A.1."
```

---

## Task 2: Replace default styles with dark-theme tokens

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 2.1: Replace globals.css**

Replace entire contents of `src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Minimal dark-theme tokens (full system in Plan 1A.2) */
  --os-bg:        #0E1014;
  --os-bg-2:      #14171C;
  --os-fg-1:      #F2EEE6;
  --os-fg-3:      rgba(242, 238, 230, 0.52);
  --os-accent:    #8FA67A;
  --os-line-2:    rgba(242, 238, 230, 0.10);
}

html, body {
  background-color: var(--os-bg);
  color: var(--os-fg-1);
  font-family: ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2.2: Update root layout**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal OS",
  description: "Max's personal operating system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2.3: Replace default home page**

Replace `src/app/page.tsx` with (it will be replaced again in Task 5 with auth redirect logic):

```tsx
export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl">Personal OS — scaffolding</h1>
      <p className="text-[color:var(--os-fg-3)] mt-2">
        Auth and modules coming next.
      </p>
    </main>
  );
}
```

- [ ] **Step 2.4: Verify dark theme**

Run: `pnpm dev`

Visit http://localhost:3000. Expected: dark canvas (`#0E1014`), cream text, "Personal OS — scaffolding" heading, dim secondary text below. Stop server.

- [ ] **Step 2.5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/app/page.tsx
git commit -m "feat: apply dark-theme tokens to globals and root layout"
```

---

## Task 3: Install Supabase dependencies + initialize CLI

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `supabase/config.toml`

- [ ] **Step 3.1: Install Supabase SDKs**

```bash
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add -D supabase
```

Expected: deps appear in `package.json`. `supabase` CLI accessible via `pnpm supabase`.

**Apple Silicon fallback:** if `pnpm supabase --version` fails with a binary-platform error, install via Homebrew instead: `brew install supabase/tap/supabase`, then use `supabase` (not `pnpm supabase`) in subsequent commands.

- [ ] **Step 3.2: Initialize Supabase locally**

```bash
pnpm supabase init
```

When prompted "Generate VS Code settings" → No. When prompted "Generate IntelliJ settings" → No.

Expected: `supabase/` directory created with `config.toml`.

- [ ] **Step 3.3: Link to remote project**

```bash
pnpm supabase link --project-ref <PROJECT_REF>
```

To find `<PROJECT_REF>`: in Supabase dashboard, Project Settings → General → Reference ID. Paste it.

When prompted for DB password, paste the password from prerequisites.

Expected: "Finished supabase link." message.

- [ ] **Step 3.4: Commit**

```bash
git add package.json pnpm-lock.yaml supabase/
git commit -m "chore: install Supabase SDK and link CLI to remote project"
```

---

## Task 4: Wire environment variables

**Files:**
- Create: `.env.local` (gitignored), `.env.example` (committed)

- [ ] **Step 4.1: Create .env.local**

Create `/Users/me/Projects/Personal OS/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_public_key>
```

Replace placeholders with actual values from Prerequisites.

- [ ] **Step 4.2: Create .env.example (committed)**

Create `/Users/me/Projects/Personal OS/.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 4.3: Verify .env.local is gitignored**

Run: `git status` — `.env.local` should NOT appear in untracked files (already excluded by `.gitignore`). `.env.example` SHOULD appear.

- [ ] **Step 4.4: Commit .env.example only**

```bash
git add .env.example
git commit -m "chore: add .env.example for required Supabase vars"
```

---

## Task 5: Create Supabase client helpers

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`

- [ ] **Step 5.1: Create browser client**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 5.2: Create server client**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
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

- [ ] **Step 5.3: Create middleware helper**

Create `src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/callback");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 5.4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase client helpers for browser, server, middleware"
```

---

## Task 6: Wire root middleware for auth redirects

**Files:**
- Create: `middleware.ts` (project root, not under `src/`)

- [ ] **Step 6.1: Create middleware**

Create `/Users/me/Projects/Personal OS/middleware.ts`:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 6.2: Verify middleware compiles**

Run: `pnpm tsc --noEmit` — expect zero errors.

- [ ] **Step 6.3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add Next.js middleware for Supabase auth redirects"
```

---

## Task 7: Create the profiles table (first migration)

**Files:**
- Create: `supabase/migrations/20260521000001_create_profiles.sql`

- [ ] **Step 7.1: Generate migration file**

```bash
pnpm supabase migration new create_profiles
```

Expected: creates `supabase/migrations/<timestamp>_create_profiles.sql`.

- [ ] **Step 7.2: Fill in migration SQL**

Open the new migration file. Replace its contents with:

```sql
-- Profiles table — operator card data; one row per auth user
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  initials text not null default '',
  role text not null default '',
  location text not null default '',
  focus text not null default '',
  streak integer not null default 0,
  timezone text not null default 'UTC',
  theme text not null default 'dark' check (theme in ('dark', 'cream', 'warm')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile row when auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 7.3: Apply migration to remote**

```bash
pnpm supabase db push
```

Expected: "Applying migration ..." message; no errors. If prompted for confirmation, type `y`.

- [ ] **Step 7.4: Verify in Supabase dashboard**

Visit Supabase dashboard → Table Editor. Confirm `public.profiles` table exists with columns above. Confirm RLS is enabled (small lock icon).

- [ ] **Step 7.5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add profiles table with RLS and auto-create trigger"
```

---

## Task 8: Build the login page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step 8.1: Create login page**

Create directory and file. Replace contents with:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
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
          <h1 className="text-2xl mt-2">Sign in</h1>
          <p className="text-sm text-[color:var(--os-fg-3)] mt-1">
            Magic link to your inbox.
          </p>
        </div>

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
              <div className="text-xs text-red-400">{errorMsg}</div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 8.2: Verify login page renders**

Run `pnpm dev`. Visit http://localhost:3000/login.

Expected: dark page, "MAX OS · V0" mono caption, "Sign in" heading, email input, sage button "Send magic link." Stop server.

- [ ] **Step 8.3: Commit**

```bash
git add 'src/app/(auth)/'
git commit -m "feat: add magic-link login page"
```

---

## Task 9: Build the auth callback route

**Files:**
- Create: `src/app/(auth)/callback/route.ts`

- [ ] **Step 9.1: Create callback handler**

Create `src/app/(auth)/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
```

- [ ] **Step 9.2: Configure Supabase redirect URLs**

In Supabase dashboard: Authentication → URL Configuration:
- Site URL: `http://localhost:3000` (for dev; we'll add production URL later)
- Redirect URLs: add `http://localhost:3000/callback`

Save.

- [ ] **Step 9.3: Commit**

```bash
git add 'src/app/(auth)/'callback/
git commit -m "feat: add auth callback route to exchange code for session"
```

---

## Task 10: Build the dashboard placeholder

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 10.1: Create dashboard placeholder**

Create `src/app/(app)/dashboard/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen p-8">
      <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--os-fg-3)]">
        MAX OS · V0 · DASHBOARD
      </div>
      <h1 className="text-2xl mt-2">
        Signed in as <span className="text-[color:var(--os-accent)]">{user.email}</span>
      </h1>
      <p className="text-sm text-[color:var(--os-fg-3)] mt-2">
        Profile id: <code className="font-mono">{profile?.id ?? "—"}</code>
      </p>
      <p className="text-sm text-[color:var(--os-fg-3)] mt-1">
        Theme: <code className="font-mono">{profile?.theme ?? "dark"}</code>
      </p>
    </main>
  );
}
```

- [ ] **Step 10.2: Replace root page with redirect**

Replace `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

The middleware will then redirect unauthenticated users from `/dashboard` to `/login`.

- [ ] **Step 10.3: Commit**

```bash
git add src/app/page.tsx 'src/app/(app)/'
git commit -m "feat: add dashboard placeholder that reads profile from Supabase"
```

---

## Task 11: Smoke-test the full sign-in flow

@superpowers:verification-before-completion applies here — we verify the actual behavior, not just that the code compiles.

> **CRITICAL FOR EXECUTING AGENT:** This task requires manual human action (Max clicks a real magic link in his email). The agent CANNOT autonomously complete steps 11.3, 11.4, 11.5, 11.6.
>
> **Agent protocol for this task:**
> 1. Execute Step 11.1 (start dev server) and Step 11.2 (verify redirect to /login).
> 2. Then PAUSE and report to the user: *"Task 11 ready. Dev server is running. Please complete the manual sign-in test (Steps 11.3 through 11.6 in the plan) and confirm the result before I continue to Task 12."*
> 3. Do not check off the manual steps' boxes yourself. Wait for the user's explicit "passed" or "failed" before proceeding.
> 4. If user reports failure, debug the root cause (do not retry blindly).

- [ ] **Step 11.1: Start dev server**

```bash
pnpm dev
```

Leave running for the next steps.

- [ ] **Step 11.2: Verify unauthenticated redirect**

Open browser to http://localhost:3000.

Expected: redirected to `/login`. The "Sign in" form is visible.

- [ ] **Step 11.3: Submit email**

Enter your real email (max.allaire@gmail.com per global CLAUDE.md). Click "Send magic link."

Expected: form replaced with "✓ Magic link sent. Check your inbox."

- [ ] **Step 11.4: Click magic link**

Open the email. Click the magic link.

Expected: lands on `/dashboard`, shows "Signed in as max.allaire@gmail.com" in sage. Profile id present. Theme: `dark`.

- [ ] **Step 11.5: Verify profile row was created**

In Supabase dashboard → Table Editor → `profiles` table.

Expected: one row exists, `id` matches the auth user id, `theme = 'dark'`, `streak = 0`.

- [ ] **Step 11.6: Verify second visit stays authenticated**

In a fresh browser tab, visit http://localhost:3000.

Expected: redirected to `/dashboard` directly (no login). Session persists.

- [ ] **Step 11.7: Stop dev server**

Ctrl-C in the terminal running `pnpm dev`.

---

## Task 12: Install + configure Playwright; write E2E smoke test

@superpowers:test-driven-development applies for the test — but auth flows require real email roundtrips that can't be automated cleanly. So this test covers the *redirect* behavior only (visit / → redirected to /login → form renders correctly). The full magic-link path is verified manually in Task 11.

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/first-signin.spec.ts`
- Modify: `package.json` (test script)

- [ ] **Step 12.1: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 12.2: Create Playwright config**

Create `/Users/me/Projects/Personal OS/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
});
```

- [ ] **Step 12.3: Write failing test first**

Create `tests/e2e/first-signin.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("first sign-in", () => {
  test("unauthenticated visit to / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("login form has email input and submit button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  });

  test("dark theme tokens are applied", async ({ page }) => {
    await page.goto("/login");
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // rgb(14, 16, 20) is #0E1014
    expect(bodyBg).toBe("rgb(14, 16, 20)");
  });
});
```

- [ ] **Step 12.4: Run the test**

```bash
pnpm exec playwright test
```

Expected: all 3 tests PASS. (The webServer config starts `pnpm dev` automatically.)

If FAIL: read the error, fix the underlying issue (not the test).

- [ ] **Step 12.5: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 12.6: Commit**

```bash
git add playwright.config.ts tests/ package.json pnpm-lock.yaml
git commit -m "test: add Playwright with first-signin redirect smoke tests"
```

---

## Task 13: Add .vercelignore + acceptance gate walkthrough

**Files:**
- Create: `.vercelignore`

- [ ] **Step 13.1: Create .vercelignore**

Create `/Users/me/Projects/Personal OS/.vercelignore`:

```
design_handoff_personal_os/
docs/
tests/
.tmp/
```

These directories shouldn't ship in the Vercel build.

- [ ] **Step 13.2: Final acceptance walkthrough**

Per Plan 1A.1's goal, verify:

- [ ] `pnpm dev` starts cleanly with no errors
- [ ] http://localhost:3000 redirects to `/login`
- [ ] `/login` shows the magic-link form with dark theme applied
- [ ] Submitting a real email triggers the email send (verified in Task 11)
- [ ] Clicking the magic link lands on `/dashboard` (verified in Task 11)
- [ ] `/dashboard` shows `Signed in as {email}` with the profile id
- [ ] Re-visiting `/` while signed in goes directly to `/dashboard`
- [ ] `pnpm exec playwright test` → all 3 tests pass
- [ ] `pnpm tsc --noEmit` → zero TypeScript errors
- [ ] `pnpm lint` → zero lint errors

If any fail, fix root cause before declaring the plan complete.

- [ ] **Step 13.3: Final commit**

```bash
git add .vercelignore
git commit -m "chore: add .vercelignore for docs and tests"
```

- [ ] **Step 13.4: Verify git log is clean**

```bash
git log --oneline
```

Expected: ~11-13 commits, all conventional-commit prefixed, no broken intermediate states.

---

## Definition of Done for Plan 1A.1

All of the following must be true:

1. Dev server starts with `pnpm dev`, no warnings or errors in the console
2. Visiting `/` unauthenticated redirects to `/login`
3. Magic link form sends an email that, when clicked, signs the user in and redirects to `/dashboard`
4. `profiles` table in Supabase has exactly one row (for max.allaire@gmail.com or whichever email used)
5. Dashboard reads from `profiles` and displays user email + profile id + theme
6. Dark theme background `#0E1014` is the body background everywhere
7. All 3 Playwright E2E tests pass
8. `pnpm tsc --noEmit` returns 0 errors
9. `pnpm lint` returns 0 errors
10. Git log shows clean, well-scoped commits with conventional-commit prefixes
11. Project structure is consistent with Next.js 14 App Router conventions; `.vercelignore` excludes non-app dirs. (Actual Vercel deployment verification deferred to Plan 1A.last — for now we only confirm the structure is right.)

**On completion:** Write Plan 1A.2 (Database schema + design tokens). The shape of that plan should be informed by anything that was harder than expected in this plan.
