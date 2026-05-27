create table public.gmail_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_id text not null,
  sender_name text not null default '',
  sender_email text not null default '',
  subject text not null default '',
  snippet text not null default '',
  received_at timestamptz not null,
  is_unread boolean not null default true,
  is_important boolean not null default false,
  labels text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, gmail_id)
);

alter table public.gmail_threads enable row level security;
create policy "gmail_threads_select_own" on public.gmail_threads for select using (auth.uid() = user_id);
create policy "gmail_threads_insert_own" on public.gmail_threads for insert with check (auth.uid() = user_id);
create policy "gmail_threads_update_own" on public.gmail_threads for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gmail_threads_delete_own" on public.gmail_threads for delete using (auth.uid() = user_id);

create index gmail_threads_user_received_idx on public.gmail_threads (user_id, received_at desc);
