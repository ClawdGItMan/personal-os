import { test, expect } from "@playwright/test";

test.describe("app skeleton", () => {
  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated /finance redirects to /login", async ({ page }) => {
    await page.goto("/finance");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login chrome renders under the dark theme", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(14, 16, 20)");
  });
});
