"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Heartbeat,
  PaperPlaneTilt,
  ShieldCheck,
  Sparkle,
  Target,
  WarningCircle,
} from "@phosphor-icons/react";
import { localCoach } from "@/lib/stride/coach";
import { dayKey, goalPace, weekDistance } from "@/lib/stride/training";
import type { Message } from "@/lib/stride/types";
import { useStride } from "./Store";
import { CoachMark, Modal, Tag } from "./ui";

export default function Coach({ checkin }: { checkin: () => void }) {
  const { state, setState, status, navigate, refreshStatus } = useStride();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state.messages.length, busy]);
  async function send(text = draft) {
    if (!text.trim() || busy) return;
    const user: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
    };
    const messages = [...state.messages, user];
    setState((previous) => (previous ? { ...previous, messages } : previous));
    setDraft("");
    setBusy(true);
    setError("");
    try {
      let reply: string;
      let mode: "ai" | "local" = "local";
      if (state.cloudCoach) {
        const shareableRuns = state.runs
          .filter((r) => r.source !== "Strava")
          .slice(0, 12);
        const response = await fetch("/api/stride/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consent: true,
            messages: messages
              .filter((m) => m.mode !== "local")
              .slice(-16)
              .map(({ role, content }) => ({ role, content })),
            context: JSON.stringify({
              today: dayKey(),
              demo: state.demo,
              profile: state.profile,
              recentRuns: shareableRuns,
              checkins: state.checkins.slice(0, 7),
              nutrition: state.meals.filter((m) => m.date === dayKey()),
            }),
          }),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "The coach is unavailable.");
        reply = result.reply;
        mode = "ai";
      } else {
        await new Promise((resolve) => setTimeout(resolve, 550));
        reply = localCoach(text, state);
      }
      setState((previous) =>
        previous
          ? {
              ...previous,
              messages: [
                ...previous.messages,
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: reply,
                  mode,
                },
              ],
            }
          : previous,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function toggleCloud() {
    if (state.cloudCoach)
      setState((previous) =>
        previous ? { ...previous, cloudCoach: false } : previous,
      );
    else {
      void refreshStatus();
      setConsentOpen(true);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">GOOD ADVICE. BETTER QUESTIONS.</div>
          <h1>A coach in your corner.</h1>
          <p>For the big goals, the tired legs, and everything in between.</p>
        </div>
        <button
          className={`button ${state.cloudCoach ? "primary" : "secondary"}`}
          onClick={toggleCloud}
        >
          <Sparkle size={17} />
          {state.cloudCoach ? "Live AI on" : "Enable live AI"}
        </button>
      </div>
      <div className="coach-layout">
        <section className="panel chat-panel">
          <div className="chat-header">
            <CoachMark />
            <div>
              <h2>Stride coach</h2>
              <p>
                <span className="status-dot" />
                {state.cloudCoach
                  ? "Live AI · Your context, thoughtfully considered"
                  : "Local preview · Rules-based coaching"}
              </p>
            </div>
            <Tag tone="green">HERE FOR YOU</Tag>
          </div>
          <div
            className="chat-messages"
            role="log"
            aria-live="polite"
            aria-label="Coach conversation"
          >
            {state.messages.map((message) => (
              <div key={message.id} className={`chat-message ${message.role}`}>
                {message.role === "assistant" ? (
                  <CoachMark />
                ) : (
                  <span className="chat-avatar">
                    {state.profile.name.slice(0, 1)}
                  </span>
                )}
                <div>
                  <span className="message-author">
                    {message.role === "assistant" ? "Stride coach" : "You"}
                    {message.role === "assistant" && (
                      <small>
                        {message.mode === "ai" ? "AI" : "LOCAL PREVIEW"}
                      </small>
                    )}
                  </span>
                  <div className="message-bubble">
                    {message.content
                      .split("\n")
                      .filter(Boolean)
                      .map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                  </div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="chat-message assistant">
                <CoachMark />
                <div
                  className="typing-indicator"
                  aria-label="Coach is thinking"
                >
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={end} />
          </div>
          {error && (
            <div className="chat-error" role="alert">
              <WarningCircle size={18} />
              <span>{error}</span>
              <button
                onClick={() => {
                  setState((previous) =>
                    previous ? { ...previous, cloudCoach: false } : previous,
                  );
                  setError("");
                }}
              >
                Use local coach
              </button>
            </div>
          )}
          <div className="chat-composer-area">
            <div className="prompt-chips">
              {[
                "Review my training week",
                "Help me fuel my long run",
                "My legs feel tired",
              ].map((prompt) => (
                <button
                  disabled={busy}
                  key={prompt}
                  onClick={() => void send(prompt)}
                >
                  {prompt}
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </div>
            <form
              className="chat-composer"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void send();
              }}
            >
              <input
                aria-label="Message your coach"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="What’s on your mind, runner?"
                maxLength={3000}
                disabled={busy}
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={!draft.trim() || busy}
              >
                <PaperPlaneTilt size={20} weight="fill" />
              </button>
            </form>
            <p className="chat-disclaimer">
              Your coach supports training decisions. It can make mistakes and
              can’t diagnose injuries.
            </p>
          </div>
        </section>
        <aside>
          <section className="panel coach-context">
            <div className="section-title">
              <h2>Your training context</h2>
              <Target size={20} />
            </div>
            <div className="context-goal">
              <span className="small-kicker">WORKING TOWARD</span>
              <h3>{state.profile.raceName}</h3>
              <p>
                {state.profile.goalTime} goal · {goalPace(state.profile)}/km
              </p>
            </div>
            <div className="detail-row">
              <span>This week</span>
              <b>{weekDistance(state.runs)} km</b>
            </div>
            <div className="detail-row">
              <span>Training days</span>
              <b>{state.profile.days} runs / week</b>
            </div>
            <div className="detail-row">
              <span>Latest check-in</span>
              <b>
                {state.checkins.find((c) => c.date === dayKey())
                  ? "Today"
                  : "Not yet"}
              </b>
            </div>
            <button className="button secondary full" onClick={checkin}>
              <Heartbeat size={17} />
              Check in with your body
            </button>
          </section>
          <section className="coach-topic-card">
            <Sparkle size={23} />
            <h3>Start with how you feel.</h3>
            <p>
              Numbers are useful. Your energy, confidence, and the way your legs
              feel matter just as much.
            </p>
            <button
              className="text-button"
              onClick={() => navigate("Training plan")}
            >
              Review your plan
              <ArrowRight size={15} />
            </button>
          </section>
          <div className="privacy-note">
            <ShieldCheck size={21} />
            <p>
              {state.cloudCoach
                ? "Live chat shares your messages, profile, check-ins, and manual or Apple Health run context with OpenAI. Strava activities are excluded."
                : "Local preview responses are generated in your browser. Your training data stays on this device."}
            </p>
          </div>
        </aside>
      </div>
      {consentOpen && (
        <Modal
          title="Make room for a conversation."
          subtitle="Live AI can use your recent training context to give more relevant answers."
          close={() => setConsentOpen(false)}
        >
          <div className="stride-form">
            <div className="info-note">
              Enabling live AI sends your messages, profile, check-ins,
              nutrition entries, and recent manual or Apple Health runs to
              OpenAI. Strava activities are excluded. You can switch back to the
              local coach at any time.
            </div>
            {!status.aiConfigured && (
              <div className="info-note amber">
                Live AI needs an OpenAI key in this local workspace. Secure key
                setup is being handled through Codex; refresh this screen after
                setup finishes.
              </div>
            )}
            <button
              className="button primary full"
              disabled={!status.aiConfigured}
              onClick={() => {
                setState((previous) =>
                  previous
                    ? {
                        ...previous,
                        cloudCoach: true,
                        messages: [
                          {
                            id: crypto.randomUUID(),
                            role: "assistant",
                            content:
                              "Live AI is ready. Tell me what you’d like to work on today, and I’ll consider the training context you’ve chosen to share.",
                            mode: "ai",
                          },
                        ],
                      }
                    : previous,
                );
                setConsentOpen(false);
              }}
            >
              <Check size={17} />
              Enable live AI & share context
            </button>
            <button
              className="button secondary full"
              onClick={() => void refreshStatus()}
            >
              Check connection again
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
