"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/callback`,
        },
      });

      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
        return;
      }

      setStatus("sent");
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--os-fg-3)]">
            MAX OS · V0
          </div>
          <h1 className="text-2xl mt-2 font-display">Sign in</h1>
          <p className="text-sm text-[color:var(--os-fg-3)] mt-1">
            Magic link to your inbox.
          </p>
        </div>

        {callbackError && status !== "sent" && (
          <div className="mb-4 text-xs text-[color:var(--os-rust)]">
            {callbackError === "missing_code"
              ? "That sign-in link was incomplete. Try again."
              : callbackError === "server_error"
                ? "Something went wrong completing sign-in. Try again."
                : decodeURIComponent(callbackError)}
          </div>
        )}

        {status === "sent" ? (
          <div className="text-sm text-[color:var(--os-accent)]">
            ✓ Magic link sent. Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 bg-[color:var(--os-bg-2)] border border-[color:var(--os-line-2)] rounded-[10px] text-sm focus:outline-none focus:border-[color:var(--os-accent)]"
              disabled={status === "sending"}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full py-2 bg-[color:var(--os-accent)] text-[color:var(--os-bg)] rounded-[10px] text-sm font-medium disabled:opacity-50"
            >
              {status === "sending" ? "Sending..." : "Send magic link"}
            </button>
            {status === "error" && (
              <div className="text-xs text-[color:var(--os-rust)]">{errorMsg}</div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
