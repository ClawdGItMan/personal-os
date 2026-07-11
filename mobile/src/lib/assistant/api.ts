import { fetch as expoFetch } from "expo/fetch";

import { supabase } from "../supabase";

/**
 * HTTP client for the Personal OS assistant API (`src/app/api/assistant/*`
 * on the web app — the same backend, reached over HTTPS from the device).
 * Every call is Bearer-authed with the current Supabase access token; every
 * call goes through `expo/fetch` rather than the RN global `fetch` because
 * `streamChat` needs a real `response.body` `ReadableStream` reader — RN's
 * built-in fetch buffers the whole body instead of streaming it. `expo/fetch`
 * falls back to `globalThis.fetch` on web, so this works on both platforms
 * the app ships (see `fetch.web.d.ts` in the `expo` package).
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://personal-os-azure-eight.vercel.app";

export class AssistantUnauthorizedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "AssistantUnauthorizedError";
  }
}

/** Thrown on a 503 `{error:"assistant_not_configured"}` — lets the UI branch
 * to an "assistant unavailable" state instead of a generic error. */
export class AssistantNotConfiguredError extends Error {
  constructor(message = "Assistant is not configured") {
    super(message);
    this.name = "AssistantNotConfiguredError";
  }
}

/** Thrown when the request never reached the network (airplane mode, DNS
 * failure, etc.) — distinct from a server error response. */
export class AssistantOfflineError extends Error {
  constructor(message = "Network request failed") {
    super(message);
    this.name = "AssistantOfflineError";
  }
}

/** Any other non-OK response (400/404/500/...). */
export class AssistantApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AssistantApiError";
    this.status = status;
  }
}

type AssistantFetchInit = {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
};

type AssistantResponse = Awaited<ReturnType<typeof expoFetch>>;

/**
 * Fetches `${BASE_URL}${path}`, attaching `Authorization: Bearer <access
 * token>` from the current Supabase session. Maps 401 → `AssistantUnauthorizedError`,
 * 503 → `AssistantNotConfiguredError`, and any thrown network error →
 * `AssistantOfflineError`. Any other status is returned as-is for the caller
 * to inspect (`res.ok`) — those are request-specific (400/500/...), not
 * auth/availability concerns this helper owns.
 */
export async function assistantFetch(path: string, init: AssistantFetchInit = {}): Promise<AssistantResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = { ...init.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body !== undefined && headers["Content-Type"] === undefined) {
    headers["Content-Type"] = "application/json";
  }

  let res: AssistantResponse;
  try {
    res = await expoFetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch (cause) {
    throw new AssistantOfflineError(cause instanceof Error ? cause.message : "Network request failed");
  }

  if (res.status === 401) throw new AssistantUnauthorizedError();
  if (res.status === 503) throw new AssistantNotConfiguredError();
  return res;
}

// ---------------------------------------------------------------------------
// GET /api/assistant/brief
// ---------------------------------------------------------------------------

export type AssistantTopMove = {
  tag: string;
  title: string;
  evidence: string;
  tool: string;
  args: Record<string, unknown>;
} | null;

export type AssistantAlsoSeeing = {
  domain: string;
  title: string;
  sub: string;
  actionLabel: string;
  tool: string | null;
  args: Record<string, unknown> | null;
};

export type AssistantBrief = {
  headline: string;
  body: string;
  statusLine: string;
  topMove: AssistantTopMove;
  alsoSeeing: AssistantAlsoSeeing[];
};

export type BriefEnvelope = {
  brief: AssistantBrief;
  generatedAt: string | null;
  cached: boolean;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function normalizeTopMove(v: unknown): AssistantTopMove {
  if (v === null || v === undefined || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  return { tag: str(r.tag), title: str(r.title), evidence: str(r.evidence), tool: str(r.tool), args: asRecord(r.args) };
}

function normalizeAlsoSeeing(v: unknown): AssistantAlsoSeeing[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    const r = asRecord(item);
    return {
      domain: str(r.domain),
      title: str(r.title),
      sub: str(r.sub),
      actionLabel: str(r.action_label),
      tool: typeof r.tool === "string" ? r.tool : null,
      args: r.args !== null && typeof r.args === "object" ? (r.args as Record<string, unknown>) : null,
    };
  });
}

/** Defensively normalizes a raw brief object (server field names, snake_case)
 * into `AssistantBrief` (camelCase) — every field falls back to a safe empty
 * value rather than throwing, since this renders straight into the Home UI. */
function normalizeBrief(v: unknown): AssistantBrief {
  const r = asRecord(v);
  return {
    headline: str(r.headline),
    body: str(r.body),
    statusLine: str(r.status_line),
    topMove: normalizeTopMove(r.top_move),
    alsoSeeing: normalizeAlsoSeeing(r.also_seeing),
  };
}

/**
 * GET /api/assistant/brief. Tolerant of either the row envelope
 * `{brief, generated_at, cached}` the route returns, or a bare brief object
 * — defensive per the contract note ("wrap in a row envelope tolerant of
 * {brief: ...} or the raw object").
 */
export async function getBrief(refresh?: boolean): Promise<BriefEnvelope> {
  const res = await assistantFetch(`/api/assistant/brief${refresh ? "?refresh=1" : ""}`);
  if (!res.ok) {
    throw new AssistantApiError(`GET /api/assistant/brief failed (${res.status})`, res.status);
  }
  const json = await res.json().catch(() => null);
  const envelope = asRecord(json);
  const rawBrief = "brief" in envelope ? envelope.brief : json;
  return {
    brief: normalizeBrief(rawBrief),
    generatedAt: typeof envelope.generated_at === "string" ? envelope.generated_at : null,
    cached: envelope.cached === true,
  };
}

// ---------------------------------------------------------------------------
// POST /api/assistant/act
// ---------------------------------------------------------------------------

export type ActResult = { ok: true; summary: string; undo?: { table: string; id: string } };

/** POST /api/assistant/act — direct write-tool execution (e.g. from a
 * brief's `topMove`/`alsoSeeing` action, or a confirmed chat suggestion). */
export async function act(tool: string, args: Record<string, unknown>): Promise<ActResult> {
  const res = await assistantFetch("/api/assistant/act", { method: "POST", body: JSON.stringify({ tool, args }) });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = typeof asRecord(body).error === "string" ? String(asRecord(body).error) : `POST /api/assistant/act failed (${res.status})`;
    throw new AssistantApiError(message, res.status);
  }
  return (await res.json()) as ActResult;
}

// ---------------------------------------------------------------------------
// POST /api/assistant/chat (streaming)
// ---------------------------------------------------------------------------

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessageInput = { role: ChatRole; content: string };
export type ChatSource = "MAX_OS" | "MOBILE_CAPTURE";

let wireIdCounter = 0;

/** Any-unique-string id for a wire message — not a Date.now() timestamp
 * alone (two messages in the same millisecond would collide). */
function nextWireId(): string {
  wireIdCounter += 1;
  return `m-${wireIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

type WireUIMessage = { id: string; role: ChatRole; parts: [{ type: "text"; text: string }] };

/**
 * Serializes the ergonomic `{role, content}[]` shape screens use into the AI
 * SDK v7 UI-message wire shape `/api/assistant/chat` validates:
 * `{id, role, parts: [{type, ...}]}` (see `chatMessageSchema` server-side —
 * every part just needs a `type` string; we only ever send plain text parts).
 */
function toWireMessages(messages: ChatMessageInput[]): WireUIMessage[] {
  return messages.map((m) => ({ id: nextWireId(), role: m.role, parts: [{ type: "text", text: m.content }] }));
}

/** Parses one SSE line's payload (`"data: {...}"` / `"data: [DONE]"`) into a
 * parsed JSON value, or `null` for `[DONE]` / blank / non-"data:" lines. No
 * network in this function on purpose — the wire-format logic stays easy to
 * reason about (and test) in isolation from the stream-reading loop. */
function parseSSEDataLine(line: string): unknown | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const payload = trimmed.slice("data:".length).trim();
  if (payload === "" || payload === "[DONE]") return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/** Extracts a text delta from a UI-message stream part, if it carries one.
 * Defensive on purpose: accepts any part whose `type` includes "text" and
 * has a string `delta` or `text` field — v7's chunk is
 * `{type:"text-delta", id, delta}`, but this also tolerates minor
 * future/alternate shapes without needing an update here. */
function textDeltaFromPart(part: unknown): string | null {
  if (!part || typeof part !== "object") return null;
  const p = part as { type?: unknown; delta?: unknown; text?: unknown };
  if (typeof p.type !== "string" || !p.type.includes("text")) return null;
  if (typeof p.delta === "string") return p.delta;
  if (typeof p.text === "string") return p.text;
  return null;
}

/** True for any tool-call/tool-result part (`"tool-*"` or `"dynamic-tool"` —
 * see the `ai` package's UI-message-stream part union). */
function isToolPart(part: unknown): boolean {
  if (!part || typeof part !== "object") return false;
  const type = (part as { type?: unknown }).type;
  return typeof type === "string" && (type === "dynamic-tool" || type.startsWith("tool-"));
}

/**
 * POST /api/assistant/chat and stream the reply. Reads the AI SDK v7
 * UI-message SSE stream (`data: {...}\n\n` events, terminated by
 * `data: [DONE]\n\n`) directly off `response.body`'s `ReadableStream` reader.
 * Calls `onDelta(delta, textSoFar)` for every text-delta part and (if given)
 * `onToolEvent(part)` with the raw part for every tool-call/result part.
 * Resolves with the full accumulated assistant text once the stream ends.
 */
export async function streamChat(
  messages: ChatMessageInput[],
  source: ChatSource | undefined,
  onDelta: (delta: string, textSoFar: string) => void,
  onToolEvent?: (part: unknown) => void,
): Promise<string> {
  const res = await assistantFetch("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ messages: toWireMessages(messages), source }),
  });

  if (!res.ok || !res.body) {
    throw new AssistantApiError(`POST /api/assistant/chat failed (${res.status})`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line ("\n\n"); an event can carry
    // multiple "data:" lines, so split what we pull off per-line too.
    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      for (const line of rawEvent.split("\n")) {
        const part = parseSSEDataLine(line);
        if (part === null) continue; // blank / non-data / [DONE]
        const delta = textDeltaFromPart(part);
        if (delta !== null) {
          text += delta;
          onDelta(delta, text);
          continue;
        }
        if (isToolPart(part)) onToolEvent?.(part);
      }
    }
  }

  return text;
}
