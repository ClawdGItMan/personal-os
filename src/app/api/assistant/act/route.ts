/**
 * POST /api/assistant/act
 *
 * Direct tool execution for the assistant's confirmation-card flow — the
 * client already knows which write tool to run (e.g. from a brief's
 * `top_move`/`also_seeing` action, or a confirmed chat suggestion) and calls
 * it here without round-tripping through the model. Auth is Bearer-token, so
 * this route is exempt from the cookie-session middleware redirect and
 * enforces its own 401 (see `src/lib/supabase/middleware.ts`).
 *
 * Only WRITE tools are reachable here (see `WRITE_TOOL_NAMES`) — read tools
 * exist for the model's own context-gathering during chat, not for a client
 * to fetch data through directly. Anything else 400s.
 */

import type { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { assistantConfigured } from "@/lib/assistant/model";
import { getUserClientFromBearer } from "@/lib/assistant/auth";
import { buildToolExecutors } from "@/lib/assistant/tools";

const WRITE_TOOL_NAMES = new Set([
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
]);

const actBodySchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: NextRequest) {
  if (!assistantConfigured()) {
    return Response.json({ error: "assistant_not_configured" }, { status: 503 });
  }

  const authed = await getUserClientFromBearer(request);
  if (!authed) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { supabase, userId } = authed;

  let body: z.infer<typeof actBodySchema>;
  try {
    body = actBodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!WRITE_TOOL_NAMES.has(body.tool)) {
    return Response.json({ error: "tool_not_allowed" }, { status: 400 });
  }

  const executors = buildToolExecutors(supabase, userId);
  const executor = executors[body.tool];
  if (!executor) {
    return Response.json({ error: "tool_not_allowed" }, { status: 400 });
  }

  try {
    const result = await executor(body.args);
    return Response.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return Response.json({ error: "invalid_args", issues: err.issues }, { status: 400 });
    }
    console.error("[assistant/act] tool execution failed:", err);
    return Response.json({ error: "tool_execution_failed" }, { status: 500 });
  }
}
