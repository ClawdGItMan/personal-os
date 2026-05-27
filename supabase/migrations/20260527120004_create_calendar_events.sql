create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  sub text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  external_id text,
  source text not null default 'manual' check (source in ('manual','google_calendar')),
  created_at timestamptz not null default now(),
  -- Dedupes synced events only. Manual events have external_id = NULL, and
  -- Postgres treats NULLs as distinct in UNIQUE, so multiple manual events are
  -- intentionally allowed; this constraint guards against duplicate provider syncs.
  unique (user_id, source, external_id)
);

alter table public.calendar_events enable row level security;
create policy "calendar_events_select_own" on public.calendar_events for select using (auth.uid() = user_id);
create policy "calendar_events_insert_own" on public.calendar_events for insert with check (auth.uid() = user_id);
create policy "calendar_events_update_own" on public.calendar_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "calendar_events_delete_own" on public.calendar_events for delete using (auth.uid() = user_id);

create index calendar_events_user_starts_idx on public.calendar_events (user_id, starts_at);
