-- Shared updated_at trigger function (reused by later migrations)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---- integrations: connection state per external provider ----
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  status text not null default 'connected' check (status in ('connected','expired','error')),
  access_token text,
  refresh_token text,
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.integrations enable row level security;
create policy "integrations_select_own" on public.integrations for select using (auth.uid() = user_id);
create policy "integrations_insert_own" on public.integrations for insert with check (auth.uid() = user_id);
create policy "integrations_update_own" on public.integrations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "integrations_delete_own" on public.integrations for delete using (auth.uid() = user_id);

create trigger integrations_set_updated_at before update on public.integrations
  for each row execute function public.set_updated_at();

-- ---- agent_messages: single conversation thread across channels (Phase 2) ----
create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('you','agent')),
  source text not null check (source in ('TELEGRAM','WEB_CAPTURE','MOBILE_CAPTURE','MAX_OS')),
  text text not null default '',
  chips jsonb not null default '[]'::jsonb,
  tool_calls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_messages enable row level security;
create policy "agent_messages_select_own" on public.agent_messages for select using (auth.uid() = user_id);
create policy "agent_messages_insert_own" on public.agent_messages for insert with check (auth.uid() = user_id);
create policy "agent_messages_update_own" on public.agent_messages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "agent_messages_delete_own" on public.agent_messages for delete using (auth.uid() = user_id);

create index agent_messages_user_created_idx on public.agent_messages (user_id, created_at desc);
