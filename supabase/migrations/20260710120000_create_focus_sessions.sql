create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  planned_minutes integer not null default 50,
  label text not null default 'Deep work',
  source text not null default 'manual' check (source in ('manual','assistant')),
  created_at timestamptz not null default now()
);

alter table public.focus_sessions enable row level security;
create policy "focus_sessions_select_own" on public.focus_sessions for select using (auth.uid() = user_id);
create policy "focus_sessions_insert_own" on public.focus_sessions for insert with check (auth.uid() = user_id);
create policy "focus_sessions_update_own" on public.focus_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "focus_sessions_delete_own" on public.focus_sessions for delete using (auth.uid() = user_id);

create index focus_sessions_user_started_idx on public.focus_sessions (user_id, started_at desc);
