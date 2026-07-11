/**
 * POST /api/assistant/chat
 *
 * Streaming chat endpoint for the Personal OS assistant. Auth is Bearer-token
 * (mobile sends `Authorization: Bearer <supabase access_token>`); this route is
 * therefore exempt from the cookie-session middleware redirect (see
 * `src/lib/supabase/middleware.ts`) and enforces its own 401.
 *
 * Request body: `{ messages: UIMessage[], source?: "MAX_OS" | "MOBILE_CAPTURE" }`.
 * `messages` follows the AI SDK v7 UI-message wire shape (`{id?, role, parts}`) —
 * validated loosely (each part just needs a `type` string) since the exact part
 * union is large and the SDK itself validates/converts on the way to the model.
 *
 * Persists the turn to `agent_messages`: the caller's latest user message on
 * receipt, and the assistant's final text + a compact tool-call summary in the
 * stream's `onFinish`. Persistence failures are logged and swallowed — a DB
 * hiccup must never break the stream the client is already reading.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  isStepCount,
  type UIMessage,
} from "ai";
import { resolveModel, assistantConfigured } from "@/lib/assistant/model";
import { getUserClientFromBearer } from "@/lib/assistant/auth";
import { buildTodayContext } from "@/lib/assistant/context";
import { buildTools } from "@/lib/assistant/tools";
import type { Json } from "@/lib/supabase/database.types";

export const maxDuration = 60;

const messagePartSchema = z.object({ type: z.string() }).catchall(z.unknown());

const chatMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["system", "user", "assistant"]),
  parts: z.array(messagePartSchema).min(1),
});

const chatBodySchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  source: z.enum(["MAX_OS", "MOBILE_CAPTURE"]).optional(),
});

const SYSTEM_PROMPT_HEADER =
  "You have the user's live health, calendar, task, habit, focus, journal and money data through tools. " +
  "Be concise and concrete — short sentences, numbers over adjectives, no emoji. When the user asks you to " +
  "log/do something, call the matching write tool, then confirm in one line. Never invent data; if a tool " +
  "returns nothing, say so.";

/** Extracts plain text from a wire-shaped or SDK `UIMessage`'s parts. Loosely
 * typed on purpose: it runs over both our own zod-validated request parts and
 * the AI SDK's own `UIMessage["parts"]` union, and only reads fields ordinary
 * text parts declare. */
function textFromParts(parts: ReadonlyArray<unknown>): string {
  return parts
    .map((p) => p as { type?: unknown; text?: unknown })
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");
}

interface ToolCallSummaryEntry {
  tool: string;
  input: unknown;
}

/** Compact `{tool, input}[]` summary of every tool part in an assistant
 * message, for the `agent_messages.tool_calls` jsonb column. */
function toolCallsFromParts(parts: UIMessage["parts"]): ToolCallSummaryEntry[] {
  const out: ToolCallSummaryEntry[] = [];
  for (const raw of parts) {
    const part = raw as { type: string; toolName?: string; input?: unknown };
    if (part.type === "dynamic-tool") {
      out.push({ tool: part.toolName ?? "unknown", input: part.input });
    } else if (part.type.startsWith("tool-")) {
      out.push({ tool: part.type.slice("tool-".length), input: part.input });
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  if (!assistantConfigured()) {
    return Response.json({ error: "assistant_not_configured" }, { status: 503 });
  }

  const authed = await getUserClientFromBearer(request);
  if (!authed) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { supabase, userId } = authed;

  let body: z.infer<typeof chatBodySchema>;
  try {
    body = chatBodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const source = body.source ?? "MAX_OS";

  const lastUserMessage = [...body.messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    const { error } = await supabase.from("agent_messages").insert({
      user_id: userId,
      role: "user",
      text: textFromParts(lastUserMessage.parts),
      source,
    });
    if (error) {
      console.error("[assistant/chat] failed to persist user message:", error.message);
    }
  }

  const [{ data: profile }, { promptText }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
    buildTodayContext(supabase, userId),
  ]);

  const name = profile?.name || "there";
  const system = `You are the Personal OS assistant for ${name}. ${SYSTEM_PROMPT_HEADER}\n\n${promptText}`;

  const tools = buildTools(supabase, userId);

  // Wire-shape messages are validated loosely above (see `messagePartSchema`);
  // the AI SDK converts/validates the concrete part union on the way to the
  // model, so this cast is the intended boundary between "our wire contract"
  // and "the SDK's UIMessage type".
  const messages = body.messages as unknown as UIMessage[];

  const result = streamText({
    model: resolveModel(),
    system,
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(6),
    tools,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        console.error("[assistant/chat] stream error:", error);
        return "assistant_error";
      },
      onFinish: async ({ responseMessage }) => {
        try {
          const { error } = await supabase.from("agent_messages").insert({
            user_id: userId,
            role: "assistant",
            text: textFromParts(responseMessage.parts),
            source,
            tool_calls: toolCallsFromParts(responseMessage.parts) as unknown as Json,
          });
          if (error) {
            console.error("[assistant/chat] failed to persist assistant message:", error.message);
          }
        } catch (err) {
          console.error("[assistant/chat] onFinish persistence failed:", err);
        }
      },
    }),
  });
}
