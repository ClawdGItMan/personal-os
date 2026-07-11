import { useCallback, useEffect, useRef, useState } from "react";

import { time12 } from "../../lib/format";
import {
  AssistantAbortedError,
  AssistantApiError,
  AssistantNotConfiguredError,
  AssistantOfflineError,
  AssistantUnauthorizedError,
  streamChat,
  type ChatMessageInput,
} from "../../lib/assistant/api";
import { supabase } from "../../lib/supabase";

/**
 * Capture's live agent session (task B7). Session-scoped only — the server
 * already persists every turn to `agent_messages`; this hook holds just the
 * exchanges rendered in the sheet right now (spec: "Capture is ephemeral by
 * design"). Everything here is UI/session state, not a data query, which is
 * why it lives beside the components that consume it rather than in
 * `lib/queries`.
 */

/** Tables the Undo action is allowed to delete from — the exact set of
 * `undo.table` values the write tools ever return (see
 * `src/lib/assistant/tools.ts`'s `ToolWriteResult`). RLS backstops every
 * delete regardless; this allowlist exists so a delete can never reach
 * `.from()` with an arbitrary server-supplied string. */
const UNDOABLE_TABLES = [
  "tasks",
  "transactions",
  "journal_entries",
  "nutrition_entries",
  "focus_sessions",
  "calendar_events",
  "habit_logs",
  "budgets",
] as const;
type UndoTable = (typeof UNDOABLE_TABLES)[number];

function isUndoTable(value: unknown): value is UndoTable {
  return typeof value === "string" && (UNDOABLE_TABLES as readonly string[]).includes(value);
}

/** Deletes one row by id from an allowlisted table. Written as an explicit
 * switch (not `supabase.from(table)` with a union-typed variable) so every
 * branch stays concretely typed against `Database` — no `any`/cast needed. */
async function deleteUndoRow(table: UndoTable, id: string): Promise<string | null> {
  switch (table) {
    case "tasks": {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      return error?.message ?? null;
    }
    case "transactions": {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      return error?.message ?? null;
    }
    case "journal_entries": {
      const { error } = await supabase.from("journal_entries").delete().eq("id", id);
      return error?.message ?? null;
    }
    case "nutrition_entries": {
      const { error } = await supabase.from("nutrition_entries").delete().eq("id", id);
      return error?.message ?? null;
    }
    case "focus_sessions": {
      const { error } = await supabase.from("focus_sessions").delete().eq("id", id);
      return error?.message ?? null;
    }
    case "calendar_events": {
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      return error?.message ?? null;
    }
    case "habit_logs": {
      const { error } = await supabase.from("habit_logs").delete().eq("id", id);
      return error?.message ?? null;
    }
    case "budgets": {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      return error?.message ?? null;
    }
  }
}

/** Friendly module tag for a confirmation card, by tool name — matches the
 * write-tool registry in `src/lib/assistant/tools.ts`. Unknown/future tool
 * names fall back to a generic "Agent" tag rather than throwing. */
const TOOL_MODULE_LABELS: Record<string, string> = {
  create_task: "Focus · Tasks",
  complete_task: "Focus · Tasks",
  toggle_habit_today: "Habits",
  create_calendar_event: "Focus · Calendar",
  start_focus_session: "Focus",
  end_focus_session: "Focus",
  log_journal: "Journal",
  add_transaction: "Money",
  log_weight: "Body",
  set_budget: "Money",
};

export type CaptureConfirmation = {
  moduleLabel: string;
  summary: string;
  undoRef: { table: UndoTable; id: string } | null;
  undone: boolean;
};

export type CaptureEntry =
  | { kind: "user"; id: string; time: string; text: string }
  | { kind: "assistant"; id: string; time: string; text: string }
  | { kind: "confirmation"; id: string; time: string; confirmation: CaptureConfirmation }
  | { kind: "notice"; id: string; tone: "notice" | "error"; title?: string; message: string; retryable: boolean };

export type ComposerState = "ready" | "sending" | "not_configured" | "offline";

let idSeq = 0;
function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

/** Extracts `{toolCallId, toolName}` from a `tool-input-start` /
 * `tool-input-available` wire chunk, used to remember which tool a later
 * `tool-output-available` result belongs to (that chunk only carries
 * `toolCallId`, not the name — see the `ai` package's `UIMessageChunk`
 * union). Returns null for any other/malformed part. */
function toolNameFromPart(part: unknown): { toolCallId: string; toolName: string } | null {
  if (!part || typeof part !== "object") return null;
  const p = part as { type?: unknown; toolCallId?: unknown; toolName?: unknown };
  if (typeof p.type !== "string" || !p.type.startsWith("tool-input")) return null;
  if (typeof p.toolCallId !== "string" || typeof p.toolName !== "string") return null;
  return { toolCallId: p.toolCallId, toolName: p.toolName };
}

/** Extracts `{toolCallId, summary, undo}` from a `tool-output-available`
 * wire chunk whose `output` matches the write tools' `ToolWriteResult`
 * shape (`{ok:true, summary, undo?}`). Defensive: any mismatch returns null
 * rather than throwing, since a read tool's output won't have `summary`. */
function toolResultFromPart(part: unknown): { toolCallId: string; summary: string; undo: { table: string; id: string } | null } | null {
  if (!part || typeof part !== "object") return null;
  const p = part as { type?: unknown; toolCallId?: unknown; output?: unknown };
  if (p.type !== "tool-output-available" || typeof p.toolCallId !== "string") return null;
  if (!p.output || typeof p.output !== "object") return null;
  const o = p.output as { summary?: unknown; undo?: unknown };
  if (typeof o.summary !== "string") return null;
  let undo: { table: string; id: string } | null = null;
  if (o.undo && typeof o.undo === "object") {
    const u = o.undo as { table?: unknown; id?: unknown };
    if (typeof u.table === "string" && typeof u.id === "string") undo = { table: u.table, id: u.id };
  }
  return { toolCallId: p.toolCallId, summary: o.summary, undo };
}

/** Extracts an error message from a `tool-output-error` wire chunk. */
function toolErrorFromPart(part: unknown): string | null {
  if (!part || typeof part !== "object") return null;
  const p = part as { type?: unknown; errorText?: unknown };
  if (p.type !== "tool-output-error") return null;
  return typeof p.errorText === "string" && p.errorText ? p.errorText : "A tool call failed.";
}

export type UseCaptureSessionResult = {
  entries: CaptureEntry[];
  input: string;
  setInput: (text: string) => void;
  composerState: ComposerState;
  send: (text: string) => void;
  retry: () => void;
  undo: (entryId: string) => void;
};

export function useCaptureSession(): UseCaptureSessionResult {
  const [entries, setEntries] = useState<CaptureEntry[]>([]);
  const [input, setInput] = useState("");
  const [composerState, setComposerState] = useState<ComposerState>("ready");

  /** `{role, content}` turns confirmed as a real round-trip — what gets
   * replayed as history on the next send. Not entries: entries also carry
   * confirmation cards / notices that aren't part of the model conversation. */
  const historyRef = useRef<ChatMessageInput[]>([]);
  const toolNamesRef = useRef<Map<string, string>>(new Map());
  const lastAttemptRef = useRef<string | null>(null);
  const entriesRef = useRef<CaptureEntry[]>(entries);
  entriesRef.current = entries;
  /** The in-flight send's abort controller, if any — aborted on unmount (the
   * sheet dismissed mid-stream) so a stale stream never keeps updating state
   * after the user has already left Capture. */
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = useCallback((rawText: string) => {
    const text = rawText.trim();
    if (!text || composerState === "sending" || composerState === "not_configured") return;

    lastAttemptRef.current = text;
    setEntries((prev) => [...prev, { kind: "user", id: nextId("u"), time: time12(new Date()), text }]);
    setInput("");
    setComposerState("sending");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let assistantEntryId: string | null = null;

    const onDelta = (_delta: string, textSoFar: string) => {
      setEntries((prev) => {
        if (assistantEntryId) {
          return prev.map((e) => (e.id === assistantEntryId ? { ...e, text: textSoFar } : e));
        }
        assistantEntryId = nextId("a");
        return [...prev, { kind: "assistant", id: assistantEntryId, time: time12(new Date()), text: textSoFar }];
      });
    };

    const onToolEvent = (part: unknown) => {
      const nameInfo = toolNameFromPart(part);
      if (nameInfo) {
        toolNamesRef.current.set(nameInfo.toolCallId, nameInfo.toolName);
        return;
      }

      const result = toolResultFromPart(part);
      if (result) {
        const toolName = toolNamesRef.current.get(result.toolCallId);
        const moduleLabel = (toolName && TOOL_MODULE_LABELS[toolName]) || "Agent";
        const undoRef = result.undo && isUndoTable(result.undo.table) ? { table: result.undo.table, id: result.undo.id } : null;
        setEntries((prev) => [
          ...prev,
          {
            kind: "confirmation",
            id: nextId("c"),
            time: time12(new Date()),
            confirmation: { moduleLabel, summary: result.summary, undoRef, undone: false },
          },
        ]);
        return;
      }

      const errorText = toolErrorFromPart(part);
      if (errorText) {
        setEntries((prev) => [...prev, { kind: "notice", id: nextId("n"), tone: "error", message: errorText, retryable: false }]);
      }
    };

    void (async () => {
      try {
        const fullText = await streamChat(
          [...historyRef.current, { role: "user", content: text }],
          "MOBILE_CAPTURE",
          onDelta,
          onToolEvent,
          { signal: controller.signal },
        );
        historyRef.current = [
          ...historyRef.current,
          { role: "user", content: text },
          ...(fullText.trim() ? [{ role: "assistant" as const, content: fullText }] : []),
        ];
        setComposerState("ready");
      } catch (err) {
        // Aborted on purpose (sheet dismissed, or a newer send superseded
        // this one) — quiet no-op, not a user-facing error.
        if (err instanceof AssistantAbortedError) return;
        if (err instanceof AssistantNotConfiguredError) {
          setComposerState("not_configured");
          setEntries((prev) => [
            ...prev,
            {
              kind: "notice",
              id: nextId("n"),
              tone: "notice",
              title: "ASSISTANT NOT CONFIGURED",
              message: "Logging will resume once the assistant is connected.",
              retryable: false,
            },
          ]);
          return;
        }
        if (err instanceof AssistantOfflineError) {
          setComposerState("offline");
          setEntries((prev) => [
            ...prev,
            {
              kind: "notice",
              id: nextId("n"),
              tone: "notice",
              title: "OFFLINE",
              message: "Couldn't reach the assistant — check your connection.",
              retryable: true,
            },
          ]);
          return;
        }
        setComposerState("ready");
        const message =
          err instanceof AssistantUnauthorizedError
            ? "Sign-in expired — try again."
            : err instanceof AssistantApiError
              ? err.message
              : "Something went wrong.";
        setEntries((prev) => [...prev, { kind: "notice", id: nextId("n"), tone: "error", message, retryable: true }]);
      }
    })();
  }, [composerState]);

  const retry = useCallback(() => {
    const text = lastAttemptRef.current;
    if (!text) return;
    setEntries((prev) => prev.filter((e) => e.kind !== "notice"));
    setComposerState("ready");
    send(text);
  }, [send]);

  const undo = useCallback((entryId: string) => {
    const found = entriesRef.current.find(
      (e): e is Extract<CaptureEntry, { kind: "confirmation" }> => e.kind === "confirmation" && e.id === entryId,
    );
    if (!found || !found.confirmation.undoRef || found.confirmation.undone) return;
    const { table, id } = found.confirmation.undoRef;

    void (async () => {
      const errorMessage = await deleteUndoRow(table, id);
      if (errorMessage) {
        setEntries((prev) => [...prev, { kind: "notice", id: nextId("n"), tone: "error", message: `Couldn't undo: ${errorMessage}`, retryable: false }]);
        return;
      }
      setEntries((prev) =>
        prev.map((e) => (e.kind === "confirmation" && e.id === entryId ? { ...e, confirmation: { ...e.confirmation, undone: true } } : e)),
      );
    })();
  }, []);

  return { entries, input, setInput, composerState, send, retry, undo };
}
