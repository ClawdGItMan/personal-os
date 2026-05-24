import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen p-8">
      <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--os-fg-3)]">
        MAX OS · V0 · DASHBOARD
      </div>
      <h1 className="text-2xl mt-2">
        Signed in as <span className="text-[color:var(--os-accent)]">{user.email}</span>
      </h1>
      <p className="text-sm text-[color:var(--os-fg-3)] mt-2">
        Profile id: <code className="font-mono">{profile?.id ?? "—"}</code>
      </p>
      <p className="text-sm text-[color:var(--os-fg-3)] mt-1">
        Theme: <code className="font-mono">{profile?.theme ?? "dark"}</code>
      </p>
    </main>
  );
}
