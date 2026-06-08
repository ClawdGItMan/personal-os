import { test, expect } from "@playwright/test";

// X (Twitter) OAuth entry point is session-gated by middleware: an unauthenticated
// request is bounced to /login before the route handler runs.
// Without a magic-link session we can only assert that redirect (the authenticated
// Connect -> X consent flow is Max's manual acceptance seam, not CI). We do
// NOT build an auth fixture or hit the X API here.
test.describe("connections (X OAuth) — unauthenticated", () => {
  test("unauthenticated /api/x/connect redirects to /login", async ({ page }) => {
    await page.goto("/api/x/connect");
    await expect(page).toHaveURL(/\/login/);
  });
});
