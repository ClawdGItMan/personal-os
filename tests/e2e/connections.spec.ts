import { test, expect } from "@playwright/test";

// Connections / Google OAuth entry points are session-gated by middleware: an
// unauthenticated request is bounced to /login before the route handler runs.
// Without a magic-link session we can only assert that redirect (the authenticated
// Connect -> Google consent flow is Max's manual acceptance seam, not CI). We do
// NOT build an auth fixture or hit Google here.
test.describe("connections (Google OAuth) — unauthenticated", () => {
  test("unauthenticated /api/google/connect redirects to /login", async ({ page }) => {
    await page.goto("/api/google/connect");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated /settings redirects to /login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});
