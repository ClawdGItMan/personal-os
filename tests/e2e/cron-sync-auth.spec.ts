import { test, expect } from "@playwright/test";

// Regression guard for the cron-middleware-auth bug.
//
// Vercel Cron invokes /api/whoop/sync and /api/google-calendar/sync with an
// `Authorization: Bearer $CRON_SECRET` header and NO Supabase session cookie.
// The root middleware matcher does not exclude /api, so updateSession() runs on
// these requests. The bug: with no session, middleware 307-redirected the cron
// request to /login *before* the route handler's own Bearer check could run.
// Because Vercel cron does not follow redirects, the sync never executed.
//
// These tests send NO valid Bearer (using the `request` fixture, which does NOT
// follow redirects by default for the status we assert) and require that the
// request reaches the route handler — which then rejects it with 401 from its
// own constant-time CRON_SECRET check. A 307 to /login here means the bug is
// present (middleware swallowed the request); a 401 means middleware correctly
// let it fall through to the handler.
//
// Determinism: .env.local sets CRON_SECRET (confirmed), so requireEnv() will not
// throw and the handler's authMatches() returns false for our (absent/bogus)
// header, yielding a stable 401. We never send a real secret, so this never runs
// an actual sync.
const CRON_SYNC_ROUTES = ["/api/whoop/sync", "/api/google-calendar/sync"];

test.describe("cron sync routes — unauthenticated must reach handler (not /login)", () => {
  for (const route of CRON_SYNC_ROUTES) {
    test(`unauthenticated GET ${route} is NOT redirected to /login and returns 401`, async ({
      request,
    }) => {
      // No Authorization header, no session cookie — exactly what an attacker
      // (and a misconfigured cron) would look like. Must hit the handler's check.
      const res = await request.get(route, { maxRedirects: 0 });
      const status = res.status();

      // Must NOT be a redirect to the login page (the bug's signature).
      expect(
        status,
        `expected handler 401, got ${status} (a 3xx means middleware redirected the cron request before its Bearer check)`,
      ).not.toBe(307);
      expect(res.headers().location ?? "").not.toContain("/login");

      // Must be the route handler's own Bearer/CRON_SECRET rejection.
      expect(status).toBe(401);
    });

    test(`bogus Bearer GET ${route} is NOT redirected to /login and returns 401`, async ({
      request,
    }) => {
      const res = await request.get(route, {
        headers: { authorization: "Bearer not-the-real-secret" },
        maxRedirects: 0,
      });
      const status = res.status();
      expect(status).not.toBe(307);
      expect(res.headers().location ?? "").not.toContain("/login");
      expect(status).toBe(401);
    });
  }
});
