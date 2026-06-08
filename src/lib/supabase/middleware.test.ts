import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Regression guard for the cron-middleware-auth bug.
//
// Vercel Cron invokes /api/whoop/sync and /api/google-calendar/sync with an
// `Authorization: Bearer $CRON_SECRET` header and NO Supabase session cookie.
// The root middleware matcher does not exclude /api, so updateSession() runs on
// these requests. The bug: with no session, updateSession() 307-redirected the
// cron request to /login *before* the route handler's own Bearer check could
// run. Because Vercel Cron does not follow redirects, the scheduled sync never
// executed.
//
// This is a UNIT test (not e2e) on purpose: the live middleware redirect only
// fires in a production build (`next start`) — `next dev` (Turbopack), which is
// what Playwright's webServer runs, does NOT execute this middleware, so a
// Playwright assertion can never go red here. Calling updateSession() directly
// with a mocked "no session" Supabase client reproduces the exact branch
// deterministically and is environment-independent.
//
// We mock @supabase/ssr so getUser() returns no user (the unauthenticated cron
// case). updateSession() then either returns a redirect to /login (status 307)
// or a pass-through NextResponse.next() (no redirect). We assert cron */sync
// paths are NOT redirected, while human/session routes still are.

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser },
  }),
}));

// Imported after the mock is registered.
import { updateSession } from "./middleware";

const ORIGIN = "https://app.example.com";

function requestFor(path: string): NextRequest {
  return new NextRequest(new URL(path, ORIGIN));
}

function redirectsToLogin(res: Response): boolean {
  if (res.status < 300 || res.status >= 400) return false;
  const location = res.headers.get("location") ?? "";
  return location.includes("/login");
}

describe("updateSession — unauthenticated routing", () => {
  beforeEach(() => {
    // No Supabase session — exactly the cron/unauthenticated case.
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: null } });
  });

  // The crux of the regression: cron sync endpoints must NOT be bounced to
  // /login, so they reach their own CRON_SECRET Bearer check. On the old
  // (unfixed) middleware these redirected to /login and this assertion fails.
  it.each([
    "/api/whoop/sync",
    "/api/google-calendar/sync",
    // Future integration crons must auto-pass via the general */sync shape.
    "/api/strava/sync",
  ])("does NOT redirect cron route %s to /login", async (path) => {
    const res = await updateSession(requestFor(path));
    expect(
      redirectsToLogin(res),
      `${path} was redirected to /login (status ${res.status}); the cron Bearer check would never run`,
    ).toBe(false);
  });

  // Regression guards: human-facing + session routes must STILL be gated. These
  // pass on both old and new middleware — they prove the fix didn't over-broaden.
  it.each([
    "/dashboard",
    "/settings",
    "/api/whoop/connect", // OAuth entry point — must stay session-gated
    "/api/google/connect",
    "/api/whoop/callback",
  ])("still redirects unauthenticated %s to /login", async (path) => {
    const res = await updateSession(requestFor(path));
    expect(
      redirectsToLogin(res),
      `${path} was NOT redirected to /login (status ${res.status}); it must stay gated`,
    ).toBe(true);
  });

  it("does NOT redirect the public /privacy page", async () => {
    const res = await updateSession(requestFor("/privacy"));
    expect(redirectsToLogin(res)).toBe(false);
  });

  it("does NOT redirect /login itself (auth route)", async () => {
    const res = await updateSession(requestFor("/login"));
    expect(redirectsToLogin(res)).toBe(false);
  });

  // Guard against the predicate being too loose: a non-cron /api path that
  // merely contains 'sync' as a segment but does not END in /sync must stay
  // gated (e.g. a hypothetical settings page about sync status).
  it("still redirects a non-cron /api route that only contains 'sync'", async () => {
    const res = await updateSession(requestFor("/api/whoop/sync-status"));
    expect(redirectsToLogin(res)).toBe(true);
  });
});
