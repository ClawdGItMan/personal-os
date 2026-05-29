-- per-integration sync log
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_synced integer not null default 0,
  status text not null default 'ok' check (status in ('ok','partial','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.sync_runs enable row level security;
create policy "sync_runs_select_own" on public.sync_runs for select using (auth.uid() = user_id);
create policy "sync_runs_insert_own" on public.sync_runs for insert with check (auth.uid() = user_id);
create policy "sync_runs_update_own" on public.sync_runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sync_runs_delete_own" on public.sync_runs for delete using (auth.uid() = user_id);

create index sync_runs_user_provider_started_idx on public.sync_runs (user_id, provider, started_at desc);

-- server-action exception log
create table public.error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text,
  severity text not null default 'error' check (severity in ('info','warn','error')),
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.error_events enable row level security;
create policy "error_events_select_own" on public.error_events for select using (auth.uid() = user_id);
create policy "error_events_insert_own" on public.error_events for insert with check (auth.uid() = user_id);
create policy "error_events_update_own" on public.error_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "error_events_delete_own" on public.error_events for delete using (auth.uid() = user_id);

create index error_events_user_created_idx on public.error_events (user_id, created_at desc);
