import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "@/lib/assistant/__tests__/fake-supabase";

// See chat/route.test.ts for why `@/lib/assistant/model` and
// `@/lib/assistant/auth` must be mocked (both are `server-only` tagged and
// unconditionally throw outside a Next.js RSC bundle).
const assistantConfigured = vi.fn();
vi.mock("@/lib/assistant/model", () => ({
  assistantConfigured: () => assistantConfigured(),
  resolveModel: () => "mock-model",
}));

const getUserClientFromBearer = vi.fn();
vi.mock("@/lib/assistant/auth", () => ({
  getUserClientFromBearer: (req: Request) => getUserClientFromBearer(req),
}));

import { POST } from "./route";

const ORIGIN = "https://app.example.com";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function actRequest(body: unknown): NextRequest {
  return new NextRequest(new URL("/api/assistant/act", ORIGIN), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-token" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/assistant/act", () => {
  beforeEach(() => {
    assistantConfigured.mockReset().mockReturnValue(true);
    getUserClientFromBearer.mockReset();
  });

  it("returns 503 assistant_not_configured without touching auth when unconfigured", async () => {
    assistantConfigured.mockReturnValue(false);
    const res = await POST(actRequest({ tool: "create_task", args: { title: "x" } }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "assistant_not_configured" });
    expect(getUserClientFromBearer).not.toHaveBeenCalled();
  });

  it("returns 401 unauthorized when getUserClientFromBearer returns null", async () => {
    getUserClientFromBearer.mockResolvedValue(null);
    const res = await POST(actRequest({ tool: "create_task", args: { title: "x" } }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("returns 400 invalid_request when tool is missing", async () => {
    const { client } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });
    const res = await POST(actRequest({ args: {} }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
  });

  it("returns 400 tool_not_allowed for a read tool (get_tasks)", async () => {
    const { client } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });
    const res = await POST(actRequest({ tool: "get_tasks", args: { scope: "today" } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "tool_not_allowed" });
  });

  it("returns 400 tool_not_allowed for a completely unknown tool name", async () => {
    const { client } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });
    const res = await POST(actRequest({ tool: "delete_everything", args: {} }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "tool_not_allowed" });
  });

  it.each([
    "get_today_overview",
    "get_health_history",
    "get_workouts",
    "get_calendar",
    "get_tasks",
    "get_money_summary",
    "get_transactions",
    "get_focus_history",
    "get_journal",
  ])("rejects read tool %s with 400 tool_not_allowed", async (tool) => {
    const { client } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });
    const res = await POST(actRequest({ tool, args: {} }));
    expect(res.status).toBe(400);
  });

  it.each([
    "create_task",
    "complete_task",
    "toggle_habit_today",
    "create_calendar_event",
    "start_focus_session",
    "end_focus_session",
    "log_journal",
    "add_transaction",
    "log_weight",
    "set_budget",
  ])("accepts write tool %s (allowlisted, reaches the executor)", async (tool) => {
    const { client } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });
    const res = await POST(actRequest({ tool, args: {} }));
    // Every write tool needs real args (empty {} will 400 on zod validation
    // inside the executor) — the point here is only that it is NOT rejected
    // as tool_not_allowed, i.e. it reached the executor at all.
    const json = await res.json();
    expect(json.error).not.toBe("tool_not_allowed");
  });

  it("executes create_task and returns its ToolWriteResult", async () => {
    const { client, db } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });

    const res = await POST(actRequest({ tool: "create_task", args: { title: "Buy milk" } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.summary).toContain("Buy milk");
    expect(json.undo).toEqual({ table: "tasks", id: expect.any(String) });

    const rows = db.get("tasks") ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: USER_ID, title: "Buy milk" });
  });

  it("returns 400 invalid_args (with zod issues) when the executor rejects the tool's own input schema", async () => {
    const { client } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });

    const res = await POST(actRequest({ tool: "create_task", args: { title: "" } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_args");
    expect(Array.isArray(json.issues)).toBe(true);
  });

  it("returns 400 invalid_args for complete_task with a non-UUID id", async () => {
    const { client } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });

    const res = await POST(actRequest({ tool: "complete_task", args: { id: "not-a-uuid" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_args");
  });

  it("defaults args to {} when omitted", async () => {
    const { client } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });

    const res = await POST(actRequest({ tool: "end_focus_session" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.summary).toBe("No active focus session to end.");
  });
});
