import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * The ONE model the assistant is allowed to use. Never hardcode another
 * model id anywhere else — always go through `resolveModel()`.
 */
const MODEL_ID = "claude-sonnet-5";

/** AI SDK "gateway model string" form — `<provider>/<model>`. Passing this
 * (instead of a `LanguageModelV4` instance) to `generateText`/`streamText`
 * routes the call through Vercel's AI Gateway, which on Vercel infra
 * authenticates via the project's OIDC token with no key management. */
const GATEWAY_MODEL_ID = "anthropic/claude-sonnet-5";

/**
 * Resolves the language model the assistant uses everywhere (chat + /act).
 *
 * - If `ANTHROPIC_API_KEY` is set (local dev, or an explicit direct-key
 *   deployment), call Anthropic directly via `@ai-sdk/anthropic`.
 * - Otherwise, return the AI Gateway model string. `generateText`/`streamText`
 *   accept this string directly as their `model` option and resolve it
 *   through the Gateway at call time — no client construction needed here.
 */
export function resolveModel(): LanguageModel {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    return createAnthropic({ apiKey })(MODEL_ID);
  }
  return GATEWAY_MODEL_ID;
}

/**
 * True when the assistant has *some* runtime path to a model: a direct
 * Anthropic key, an explicit AI Gateway key, or a Vercel runtime (where the
 * Requires an explicit key: `ANTHROPIC_API_KEY` (direct) or
 * `AI_GATEWAY_API_KEY` (Vercel AI Gateway). `process.env.VERCEL` was
 * originally accepted as a proxy for OIDC-backed Gateway access, but it is
 * always set on Vercel — with the Gateway not enabled, routes attempted the
 * call and 500'd instead of degrading to the designed 503
 * "assistant_not_configured" (caught by the prod curl smoke, 2026-07-10).
 * Routes use this to short-circuit into the clear "not configured" response.
 */
export function assistantConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.AI_GATEWAY_API_KEY);
}
