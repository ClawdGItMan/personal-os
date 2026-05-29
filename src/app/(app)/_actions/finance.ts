"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";

const ACCOUNT_TYPES = ["BANK", "HYSA", "EQUITY", "RETIRE", "CRYPTO", "PRIVATE", "T_BILLS"] as const;

const AddAccount = z.object({
  name: z.string().min(1, "Account name required").max(80),
  type: z.enum(ACCOUNT_TYPES),
  current_value: z.number().min(0).max(1e12),
});

const UpdateBalance = z.object({
  id: z.string().min(1),
  value: z.number().min(0).max(1e12),
});

export async function addAccount(input: unknown): Promise<ActionResult> {
  const parsed = AddAccount.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { data: acct, error } = await supabase
    .from("finance_accounts")
    .insert({
      user_id: userId,
      name: parsed.data.name,
      type: parsed.data.type,
      current_value: parsed.data.current_value,
      source: "manual",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Seed today's snapshot so the net-worth sparkline has a starting point.
  if (acct) {
    await supabase
      .from("finance_snapshots")
      .upsert(
        { user_id: userId, account_id: acct.id, date: todayISO(), value: parsed.data.current_value },
        { onConflict: "account_id,date" },
      );
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateBalance(input: unknown): Promise<ActionResult> {
  const parsed = UpdateBalance.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_accounts")
    .update({ current_value: parsed.data.value })
    .eq("id", parsed.data.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("finance_snapshots")
    .upsert(
      { user_id: userId, account_id: parsed.data.id, date: todayISO(), value: parsed.data.value },
      { onConflict: "account_id,date" },
    );

  revalidatePath("/dashboard");
  return { ok: true };
}
