import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Current authenticated user id, or null. Cached per request. */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});
