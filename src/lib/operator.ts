import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { initialsFrom } from "@/lib/format";
import type { Operator } from "@/lib/types";

/**
 * Fetch the current operator (profile + auth user) with sensible fallbacks.
 * Wrapped in React `cache()` so the layout and the page share one query per request.
 */
export const getOperator = cache(async (): Promise<Operator | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: p } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const name = p?.name?.trim() || user.email?.split("@")[0] || "Operator";
  const first = name.split(/\s+/)[0] ?? name;

  return {
    name,
    first,
    initials: p?.initials?.trim() || initialsFrom(name),
    role: p?.role ?? "",
    location: p?.location ?? "",
    focus: p?.focus ?? "",
    streak: p?.streak ?? 0,
    timezone: p?.timezone ?? "",
    email: user.email ?? "",
  };
});
