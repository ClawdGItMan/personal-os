/**
 * GET /api/assistant/brief
 *
 * Returns today's assistant brief: a short cross-domain synthesis (headline,
 * body, status line, one top suggested move, up to 3 "also seeing" items) for
 * the Home screen. Auth is Bearer-token, so this route is exempt from the
 * cookie-session middleware redirect and enforces its own 401 (see
 * `src/lib/supabase/middleware.ts`).
 *
 * Caching: returns the newest `assistant_briefs` row if it's under 2 hours
 * old; otherwise (or when `?refresh=1` is passed) regenerates via
 * `generateText` + structured output, persists the new row, and returns it.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { generateText, Output } from "ai";
import { resolveModel, assistantConfigured } from "@/lib/assistant/model";
import { getUserClientFromBearer } from "@/lib/assistant/auth";
import { buildTodayContext } from "@/lib/assistant/context";
import type { Json } from "@/lib/supabase/database.types";

export const maxDuration = 60;

const FRESHNESS_MS = 2 * 60 * 60 * 1000; // 2 hours

const WRITE_TOOL_NAMES = [
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
] as const;

const briefSchema = z.object({
  headline: z.string().max(40), // "You're on pace, Max."
  body: z.string().max(200), // one-line cross-domain synthesis
  status_line: z.string().max(140), // Home greeting status, markdown-free
  top_move: z
    .object({
      tag: z.string().max(24), // "TOP MOVE · CAL + BODY"
      title: z.string().max(60),
      evidence: z.string().max(90), // uppercase mono line
      tool: z.string(), // one of the write-tool names
      args: z.record(z.string(), z.any()),
    })
    .nullable(),
  also_seeing: z
    .array(
      z.object({
        domain: z.enum(["FOCUS", "MONEY", "BODY", "HABIT", "CAL"]),
        title: z.string().max(60),
        sub: z.string().max(60),
        action_label: z.string().max(12),
        tool: z.string().nullable(),
        args: z.record(z.string(), z.any()).nullable(),
      }),
    )
    .max(3),
});

export type AssistantBrief = z.infer<typeof briefSchema>;

function isFresh(generatedAt: string): boolean {
  return Date.now() - new Date(generatedAt).getTime() < FRESHNESS_MS;
}

function buildBriefPrompt(name: string, contextText: string): string {
  return [
    `You are generating today's brief for ${name}'s Personal OS home screen.`,
    "Synthesize the data below into: a short headline (max 40 chars, e.g. " +
      '"You\'re on pace, Max."), a one-line cross-domain body (max 200 chars), a ' +
      "status_line for the greeting (max 140 chars, markdown-free), one top_move " +
      "(the single highest-leverage suggested action, or null if nothing stands " +
      'out) tagged like "TOP MOVE · DOMAIN + DOMAIN", and up to 3 also_seeing items ' +
      "from other domains (FOCUS, MONEY, BODY, HABIT, CAL).",
    "Be concise and concrete — numbers over adjectives, no emoji, no markdown. Never invent data not present below.",
    `When a top_move or also_seeing item has a follow-up action, tool must be exactly one of: ${WRITE_TOOL_NAMES.join(", ")} — and args must match that tool's expected input. Use tool: null (and args: null for also_seeing) when there's no actionable follow-up.`,
    "",
    contextText,
  ].join("\n");
}

export async function GET(request: NextRequest) {
  if (!assistantConfigured()) {
    return Response.json({ error: "assistant_not_configured" }, { status: 503 });
  }

  const authed = await getUserClientFromBearer(request);
  if (!authed) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { supabase, userId } = authed;

  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";

  if (!forceRefresh) {
    const { data: existing, error } = await supabase
      .from("assistant_briefs")
      .select("*")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return Response.json({ error: "brief_lookup_failed" }, { status: 500 });
    }
    if (existing && isFresh(existing.generated_at)) {
      return Response.json({ brief: existing.brief, generated_at: existing.generated_at, cached: true });
    }
  }

  try {
    const [{ promptText }, profileResult] = await Promise.all([
      buildTodayContext(supabase, userId),
      supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
    ]);

    const name = profileResult.data?.name || "there";
    const prompt = buildBriefPrompt(name, promptText);

    const { output } = await generateText({
      model: resolveModel(),
      output: Output.object({ schema: briefSchema }),
      prompt,
    });

    const parsed = briefSchema.parse(output);

    const { data: inserted, error: insertError } = await supabase
      .from("assistant_briefs")
      .insert({ user_id: userId, brief: parsed as unknown as Json })
      .select("*")
      .single();
    if (insertError) {
      return Response.json({ error: "brief_persist_failed" }, { status: 500 });
    }

    return Response.json({ brief: inserted.brief, generated_at: inserted.generated_at, cached: false });
  } catch (err) {
    console.error("[assistant/brief] generation failed:", err);
    return Response.json({ error: "brief_generation_failed" }, { status: 500 });
  }
}
