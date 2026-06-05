create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual','whoop','strava','apple_health')),
  external_id text,                 -- provider workout id; null for manual rows (NULLs are distinct in the unique index)
  sport text not null default '',
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_sec integer,
  strain numeric(4,1),              -- Whoop-specific; nullable
  avg_hr integer,
  max_hr integer,
  energy_kj numeric(8,1),           -- Whoop reports kilojoules; nullable
  distance_m numeric(10,1),         -- Strava/runs later; nullable
  source_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table public.workouts enable row level security;
create policy "workouts_select_own" on public.workouts for select using (auth.uid() = user_id);
create policy "workouts_insert_own" on public.workouts for insert with check (auth.uid() = user_id);
create policy "workouts_update_own" on public.workouts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workouts_delete_own" on public.workouts for delete using (auth.uid() = user_id);

create index workouts_user_started_idx on public.workouts (user_id, started_at desc);
