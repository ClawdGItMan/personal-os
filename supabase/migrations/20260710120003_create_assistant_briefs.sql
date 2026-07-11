-- assistant_briefs (cached generated brief)
create table public.assistant_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  brief jsonb not null default '{}'::jsonb
);

alter table public.assistant_briefs enable row level security;
create policy "assistant_briefs_select_own" on public.assistant_briefs for select using (auth.uid() = user_id);
create policy "assistant_briefs_insert_own" on public.assistant_briefs for insert with check (auth.uid() = user_id);
create policy "assistant_briefs_update_own" on public.assistant_briefs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "assistant_briefs_delete_own" on public.assistant_briefs for delete using (auth.uid() = user_id);

create index assistant_briefs_user_generated_idx on public.assistant_briefs (user_id, generated_at desc);
