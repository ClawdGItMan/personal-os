create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  tags text[] not null default '{}',
  star boolean not null default false,
  done boolean not null default false,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
create policy "tasks_select_own" on public.tasks for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks for delete using (auth.uid() = user_id);

create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

create index tasks_user_done_idx on public.tasks (user_id, done);
create index tasks_user_due_idx on public.tasks (user_id, due_at);
