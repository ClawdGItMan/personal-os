-- one row per day; source-priority resolved at write time via upsert on (user_id, date)
create table public.health_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep_score integer,
  sleep_hours numeric(4,1),
  recovery_score integer,
  strain numeric(4,1),
  hrv integer,
  rhr integer,
  weight numeric(6,2),
  weight_unit text not null default 'lbs' check (weight_unit in ('lbs','kg')),
  steps integer,
  vo2_max numeric(4,1),
  source text not null default 'manual' check (source in ('manual','whoop','apple_health','oura')),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.health_snapshots enable row level security;
create policy "health_snapshots_select_own" on public.health_snapshots for select using (auth.uid() = user_id);
create policy "health_snapshots_insert_own" on public.health_snapshots for insert with check (auth.uid() = user_id);
create policy "health_snapshots_update_own" on public.health_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "health_snapshots_delete_own" on public.health_snapshots for delete using (auth.uid() = user_id);

create index health_snapshots_user_date_idx on public.health_snapshots (user_id, date);
