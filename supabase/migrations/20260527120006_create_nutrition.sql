create table public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  kcal integer not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  eaten_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','agent')),
  created_at timestamptz not null default now()
);

alter table public.nutrition_entries enable row level security;
create policy "nutrition_entries_select_own" on public.nutrition_entries for select using (auth.uid() = user_id);
create policy "nutrition_entries_insert_own" on public.nutrition_entries for insert with check (auth.uid() = user_id);
create policy "nutrition_entries_update_own" on public.nutrition_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nutrition_entries_delete_own" on public.nutrition_entries for delete using (auth.uid() = user_id);

create index nutrition_entries_user_eaten_idx on public.nutrition_entries (user_id, eaten_at);
