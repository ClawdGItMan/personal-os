import { test, expect } from "@playwright/test";

// The /api/apple-health/ingest route is PUBLIC (no session cookie required) but
// uses its own token-based auth. All three cases below exercise the auth guard
// using Playwright's `request` context (no browser navigation needed).
//
// We do NOT mint a real token or hit DB writers — the happy-path POST is Max's
// manual acceptance seam and is not part of CI.
//
// NOTE on case 2: the "well-formed token, no matching integration" path hits the
// Supabase admin client (step 2 of the route) which requires SUPABASE_SERVICE_ROLE_KEY.
// That key is present in production (Vercel env vars) but not in local .env.local —
// so case 2 is skipped locally and will run in CI where the key is set.
test.describe("apple-health ingest — unauthenticated 401 cases", () => {
  test("no Authorization header → 401", async ({ request }) => {
    // Rejected at step 1 (splitIngestToken returns null — no header at all).
    const response = await request.post("/api/apple-health/ingest", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(401);
  });

  test(
    "well-formed token with no matching integration → 401",
    {
      annotation: {
        type: "skip-condition",
        description:
          "Requires SUPABASE_SERVICE_ROLE_KEY (present in CI/prod, not in local .env.local). " +
          "Route correctly returns 401 when the integration row is not found.",
      },
    },
    async ({ request }) => {
      // Format: <userId>.<secret> — userId is a real UUID shape, secret is wrong.
      // Passes splitIngestToken (step 1) but the integrations DB lookup (step 2)
      // finds no row and returns 401. Requires the admin client to be configured.
      test.skip(
        !process.env.SUPABASE_SERVICE_ROLE_KEY,
        "SUPABASE_SERVICE_ROLE_KEY not set — skipping DB-dependent 401 check",
      );
      const response = await request.post("/api/apple-health/ingest", {
        data: {},
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer 00000000-0000-0000-0000-000000000000.wrong-secret",
        },
      });
      expect(response.status()).toBe(401);
    },
  );

  test("malformed token (no dot) → 401", async ({ request }) => {
    // Rejected at step 1 — splitIngestToken returns null when there is no dot.
    const response = await request.post("/api/apple-health/ingest", {
      data: {},
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer nodot",
      },
    });
    expect(response.status()).toBe(401);
  });
});
