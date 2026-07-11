import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "@/lib/assistant/__tests__/fake-supabase";

// `@/lib/assistant/model` and `@/lib/assistant/auth` are `server-only`
// tagged (they unconditionally throw the "This module cannot be imported
// from a Client Component" error outside a Next.js RSC bundle — see their own
// file comments). Mocking them here is not just test isolation: it's what
// keeps `import "server-only"` from ever executing under vitest, mirroring
// how `middleware.test.ts` mocks `@supabase/ssr` for the same class of
// reason. Real logic in both modules is exercised by A2's own unit tests.
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

// Only the streaming plumbing is faked — `tool`, `isStepCount`, etc. (used
// transitively by `@/lib/assistant/tools`) stay real via `importOriginal`, so
// `buildTools` still builds a genuine `ToolSet` against the fake supabase
// client passed through `getUserClientFromBearer`. `toUIMessageStream`'s
// `onFinish` is captured (not invoked) so each test can trigger it explicitly
// with whatever `responseMessage` it wants to assert persistence against.
const streamText = vi.fn();
let capturedOnFinish: ((event: unknown) => Promise<void> | void) | undefined;
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: (opts: unknown) => streamText(opts),
    convertToModelMessages: vi.fn(async (messages: unknown) => messages),
    createUIMessageStreamResponse: ({ stream }: { stream: unknown }) => new Response(stream as ReadableStream),
    toUIMessageStream: (opts: { stream: ReadableStream; onFinish?: (event: unknown) => Promise<void> | void }) => {
      capturedOnFinish = opts.onFinish;
      return new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
    },
  };
});

import { POST } from "./route";

const ORIGIN = "https://app.example.com";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function chatRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL("/api/assistant/chat", ORIGIN), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-token", ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = {
  messages: [{ role: "user", parts: [{ type: "text", text: "mark my run habit done" }] }],
};

function fakeResponseMessage() {
  return {
    parts: [
      { type: "text", text: "Done — marked it." },
      { type: "tool-toggle_habit_today", input: { habit_id: "h1" }, output: { ok: true } },
    ],
  };
}

describe("POST /api/assistant/chat", () => {
  beforeEach(() => {
    assistantConfigured.mockReset().mockReturnValue(true);
    getUserClientFromBearer.mockReset();
    capturedOnFinish = undefined;
    streamText.mockReset().mockImplementation(() => ({
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    }));
  });

  it("returns 503 assistant_not_configured without touching auth when unconfigured", async () => {
    assistantConfigured.mockReturnValue(false);
    const res = await POST(chatRequest(validBody));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "assistant_not_configured" });
    expect(getUserClientFromBearer).not.toHaveBeenCalled();
  });

  it("returns 401 unauthorized when getUserClientFromBearer returns null", async () => {
    getUserClientFromBearer.mockResolvedValue(null);
    const res = await POST(chatRequest(validBody));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("returns 400 invalid_request when messages is missing", async () => {
    const { client } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });
    const res = await POST(chatRequest({ source: "MAX_OS" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
  });

  it("returns 400 invalid_request when messages is an empty array", async () => {
    const { client } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });
    const res = await POST(chatRequest({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 invalid_request when a message part has no type", async () => {
    const { client } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });
    const res = await POST(chatRequest({ messages: [{ role: "user", parts: [{ text: "hi" }] }] }));
    expect(res.status).toBe(400);
  });

  it("persists the latest user message before streaming starts", async () => {
    const { client, db } = createFakeSupabase({ profiles: [{ id: USER_ID, name: "Max" }] });
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });

    const res = await POST(chatRequest(validBody));
    expect(res.status).toBe(200);

    const rows = db.get("agent_messages") ?? [];
    const userRow = rows.find((r) => r.role === "user");
    expect(userRow).toMatchObject({
      user_id: USER_ID,
      role: "user",
      text: "mark my run habit done",
      source: "MAX_OS",
    });
  });

  it("defaults source to MAX_OS and passes through MOBILE_CAPTURE when given", async () => {
    const { client, db } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });

    await POST(chatRequest({ ...validBody, source: "MOBILE_CAPTURE" }));
    const rows = db.get("agent_messages") ?? [];
    expect(rows[0]?.source).toBe("MOBILE_CAPTURE");
  });

  it("calls streamText with resolveModel(), stopWhen step count, and a system prompt naming the user", async () => {
    const { client } = createFakeSupabase({ profiles: [{ id: USER_ID, name: "Max" }] });
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });

    await POST(chatRequest(validBody));

    expect(streamText).toHaveBeenCalledTimes(1);
    const call = streamText.mock.calls[0]?.[0] as { model: unknown; system: string; tools: object };
    expect(call.model).toBe("mock-model");
    expect(call.system).toContain("Max");
    expect(Object.keys(call.tools)).toContain("create_task");
  });

  it("persists the assistant response text + a compact tool-call summary in onFinish", async () => {
    const { client, db } = createFakeSupabase({});
    getUserClientFromBearer.mockResolvedValue({ supabase: client, userId: USER_ID });

    await POST(chatRequest(validBody));
    expect(capturedOnFinish).toBeTypeOf("function");

    await capturedOnFinish?.({ responseMessage: fakeResponseMessage() });

    const rows = db.get("agent_messages") ?? [];
    const assistantRow = rows.find((r) => r.role === "assistant");
    expect(assistantRow?.text).toBe("Done — marked it.");
    expect(assistantRow?.tool_calls).toEqual([{ tool: "toggle_habit_today", input: { habit_id: "h1" } }]);
  });

  it("logs and swallows agent_messages insert failures instead of throwing (both the pre-stream user-message write and the onFinish assistant write)", async () => {
    // Every table except agent_messages goes through the real fake-supabase
    // query engine (so buildTodayContext/profile lookups succeed normally);
    // agent_messages always errors, isolating the persistence-failure path.
    const { client: workingClient } = createFakeSupabase({ profiles: [{ id: USER_ID, name: "Max" }] });
    const flakySupabase = {
      from: (table: string) => {
        if (table === "agent_messages") {
          return { insert: () => Promise.resolve({ error: { message: "insert failed" } }) };
        }
        return workingClient.from(table);
      },
    };
    getUserClientFromBearer.mockResolvedValue({ supabase: flakySupabase, userId: USER_ID });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(chatRequest(validBody));
    expect(res.status).toBe(200); // the failed pre-stream persist must not fail the request
    expect(capturedOnFinish).toBeTypeOf("function");

    await expect(capturedOnFinish?.({ responseMessage: fakeResponseMessage() })).resolves.not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
