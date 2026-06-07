import { test, expect } from "@playwright/test";

// Whoop OAuth entry point is session-gated by middleware: an unauthenticated
// request is bounced to /login before the route handler runs.
// Without a magic-link session we can only assert that redirect (the authenticated
// Connect -> Whoop consent flow is Max's manual acceptance seam, not CI). We do
// NOT build an auth fixture or hit Whoop here.
test.describe("connections (Whoop OAuth) — unauthenticated", () => {
  test("unauthenticated /api/whoop/connect redirects to /login", async ({ page }) => {
    await page.goto("/api/whoop/connect");
    await expect(page).toHaveURL(/\/login/);
  });
});
