import { test, expect } from "@playwright/test";

// Secondary pages + Settings are all session-gated. Without a magic-link session we
// can only assert the auth redirect (the authenticated render is Max's manual seam).
test.describe("secondary pages + settings", () => {
  for (const path of ["/settings", "/journal", "/social"]) {
    test(`unauthenticated ${path} redirects to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
