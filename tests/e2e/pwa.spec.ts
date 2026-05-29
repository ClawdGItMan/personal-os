import { test, expect } from "@playwright/test";

// PWA assets must be reachable WITHOUT a session (Lighthouse/installers fetch them from
// the login screen). The manifest is allow-listed in the middleware matcher; icons pass
// via the existing *.png exclusion.
test.describe("pwa", () => {
  test("manifest is reachable unauthenticated and valid", async ({ request }) => {
    const res = await request.get("/manifest.json");
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m.name).toBe("Personal OS");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.theme_color).toBe("#0E1014");
    expect(m.background_color).toBe("#0E1014");
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
  });

  for (const icon of ["icon-192.png", "icon-512.png", "icon-512-maskable.png"]) {
    test(`icon ${icon} is a reachable PNG`, async ({ request }) => {
      const res = await request.get(`/icons/${icon}`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
    });
  }

  test("login head advertises manifest + theme-color", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.json/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0E1014");
  });
});
