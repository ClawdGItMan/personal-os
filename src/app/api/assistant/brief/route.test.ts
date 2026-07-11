import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "@/lib/assistant/__tests__/fake-supabase";

// See chat/route.test.ts for why `@/lib/assistant/model` and
// `@/lib/assistant/auth` must be mocked (both are `server-only` tagged and
// unconditionally throw outside a Next.js RSC bundle — mocking here prevents
// that import from ever executing under vitest).
const assistantConfigured = vi.fn();
const resolveModel = vi.fn(() => "mock-model");
vi.mock("@/lib/assistant/model", () => ({
  assistantConfigured: () => assistantConfigured(),
  resolveModel: () => resolveModel(),
}));

const getUserClientFromBearer = vi.fn();
vi.mock("@/lib/assistant/auth", () => ({
  getUserClientFromBearer: (req: Request) => getUserClientFromBearer(req),
}));

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: (opts: unknown) => generateText(opts),
  };
});

import { GET } from "./route";

const ORIGIN = "https://app.example.com";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function briefRequest(path = "/api/assistant/brief"): NextRequest {
  return new NextRequest(new URL(path, ORIGIN), {
    headers: { authorization: "Bearer test-token" },
  });
}

const VALID_BRIEF_OUTPUT = {
  headline: "You're on pace, Max.",
  body: "Recovery is solid and the calendar is light — good day to push focus work.",
  status_line: "Recovery 82%, nothing urgent due today.",
  top_move: {
    tag: "TOP MOVE · CAL + BODY",
    title: "Block 90 min for deep work at 2pm",
    evidence: "RECOVERY 82% · CALENDAR OPEN 1PM-4PM",
    tool: "start_focus_session",
    args: { label: "Deep work", planned_minutes: 90 },
  },
  also_seeing: [],
};

describe("GET /api/assistant/brief", () => {
  beforeEach(() => {
    assistantConfigured.mockReset().mockReturnValue(true);
    getUserClientFromBearer.mockReset();
    generateText.mockReset().mockResolvedValue({ output: VALID_BRIEF_OUTPUT });
    vi.useRealTimers();
  });

  it("returns 503 assistant_not_configured without touching auth when unconfigured", async () => {
    assistantConfigured.mockReturnValue(false);
    const res = await GET(briefRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "assistant_not_configured" });
    expect(getUserClientFromBearer).not.toHaveBeenCalled();
  });

  it("returns 401 unauthorized when getUserClientFromBearer returns null", async () => {
    getUserClientFromBearer.mockResolvedValue(null);
    const res = await GET(briefRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("returns the cached row (no generation) when the newest brief is under 2 hours old", async () => {
    const generatedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    const { client } = createFakeSupabase({
      assistant_briefs: [{ id: "b1", user_id: USER_ID, brief: VALID_BRIEF_OUTPUT, generated_at: generatedAt }],
    });
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });

    const res = await GET(briefRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(true);
    expect(json.generated_at).toBe(generatedAt);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("regenerates when the newest brief is 2+ hours old", async () => {
    const staleAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3h ago
    const { client, db } = createFakeSupabase({
      assistant_briefs: [{ id: "b1", user_id: USER_ID, brief: { headline: "stale" }, generated_at: staleAt }],
      profiles: [{ id: USER_ID, name: "Max" }],
    });
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });

    const res = await GET(briefRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(false);
    expect(json.brief).toEqual(VALID_BRIEF_OUTPUT);
    expect(generateText).toHaveBeenCalledTimes(1);

    const rows = db.get("assistant_briefs") ?? [];
    expect(rows).toHaveLength(2); // stale row + newly inserted row
  });

  it("regenerates even when the newest brief is fresh, given ?refresh=1", async () => {
    const generatedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago — well within freshness window
    const { client } = createFakeSupabase({
      assistant_briefs: [{ id: "b1", user_id: USER_ID, brief: { headline: "old" }, generated_at: generatedAt }],
      profiles: [{ id: USER_ID, name: "Max" }],
    });
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });

    const res = await GET(briefRequest("/api/assistant/brief?refresh=1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(false);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("calls generateText with resolveModel() and an Output.object structured-output spec", async () => {
    const { client } = createFakeSupabase({ profiles: [{ id: USER_ID, name: "Max" }] });
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });

    await GET(briefRequest());

    expect(generateText).toHaveBeenCalledTimes(1);
    const call = generateText.mock.calls[0]?.[0] as { model: unknown; output: unknown; prompt: string };
    expect(call.model).toBe("mock-model");
    expect(call.output).toBeDefined();
    expect(call.prompt).toContain("Max");
  });

  it("returns 500 brief_generation_failed when the model call throws", async () => {
    const { client } = createFakeSupabase({ profiles: [{ id: USER_ID, name: "Max" }] });
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });
    generateText.mockRejectedValue(new Error("model unavailable"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(briefRequest());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "brief_generation_failed" });

    consoleErrorSpy.mockRestore();
  });

  it("returns 500 brief_generation_failed when the model's output fails brief-schema validation", async () => {
    const { client } = createFakeSupabase({ profiles: [{ id: USER_ID, name: "Max" }] });
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });
    generateText.mockResolvedValue({ output: { headline: "missing everything else" } });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(briefRequest());
    expect(res.status).toBe(500);

    consoleErrorSpy.mockRestore();
  });
});
