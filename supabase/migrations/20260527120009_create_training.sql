create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  split_name text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.training_sessions enable row level security;
create policy "training_sessions_select_own" on public.training_sessions for select using (auth.uid() = user_id);
create policy "training_sessions_insert_own" on public.training_sessions for insert with check (auth.uid() = user_id);
create policy "training_sessions_update_own" on public.training_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "training_sessions_delete_own" on public.training_sessions for delete using (auth.uid() = user_id);

create trigger training_sessions_set_updated_at before update on public.training_sessions
  for each row execute function public.set_updated_at();

create table public.lifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  name text not null,
  weight numeric(7,2) not null default 0,
  weight_unit text not null default 'lbs' check (weight_unit in ('lbs','kg')),
  reps integer not null default 0,
  sets integer not null default 1,
  is_pr boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.lifts enable row level security;
create policy "lifts_select_own" on public.lifts for select using (auth.uid() = user_id);
create policy "lifts_insert_own" on public.lifts for insert with check (auth.uid() = user_id);
create policy "lifts_update_own" on public.lifts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lifts_delete_own" on public.lifts for delete using (auth.uid() = user_id);

create index lifts_session_idx on public.lifts (session_id);
