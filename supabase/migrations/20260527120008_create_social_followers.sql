-- one row per platform per day
create table public.social_followers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('X','LINKEDIN','SUBSTACK','GITHUB','IG')),
  date date not null,
  count integer not null default 0,
  source text not null default 'manual' check (source in ('manual','github','api')),
  created_at timestamptz not null default now(),
  unique (user_id, platform, date)
);

alter table public.social_followers enable row level security;
create policy "social_followers_select_own" on public.social_followers for select using (auth.uid() = user_id);
create policy "social_followers_insert_own" on public.social_followers for insert with check (auth.uid() = user_id);
create policy "social_followers_update_own" on public.social_followers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "social_followers_delete_own" on public.social_followers for delete using (auth.uid() = user_id);

create index social_followers_user_platform_date_idx on public.social_followers (user_id, platform, date);
