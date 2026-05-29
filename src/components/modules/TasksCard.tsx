import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/primitives/Card";
import { TasksClient, type TaskRow } from "./tasks/TasksClient";

export async function TasksCard() {
  const supabase = await createClient();
  // RLS scopes rows to the current user.
  const { data } = await supabase
    .from("tasks")
    .select("id, title, star")
    .eq("done", false)
    .order("star", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const tasks: TaskRow[] = data ?? [];
  const starred = tasks.filter((t) => t.star).length;

  return (
    <Card num="04" title="TODAY · KEY" meta={`${starred} STARRED`}>
      <TasksClient initialTasks={tasks} />
    </Card>
  );
}
