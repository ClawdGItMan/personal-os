import { test, expect } from "@playwright/test";

// Strava OAuth entry point is session-gated by middleware: an unauthenticated
// request is bounced to /login before the route handler runs.
// Without a magic-link session we can only assert that redirect (the authenticated
// Connect -> Strava consent flow is Max's manual acceptance seam, not CI). We do
// NOT build an auth fixture or hit Strava here.
test.describe("connections (Strava OAuth) — unauthenticated", () => {
  test("unauthenticated /api/strava/connect redirects to /login", async ({ page }) => {
    await page.goto("/api/strava/connect");
    await expect(page).toHaveURL(/\/login/);
  });
});
