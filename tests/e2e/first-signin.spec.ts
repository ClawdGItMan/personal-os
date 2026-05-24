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
