create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('BANK','HYSA','EQUITY','RETIRE','CRYPTO','PRIVATE','T_BILLS')),
  current_value numeric(18,2) not null default 0,
  plaid_account_id text,
  source text not null default 'manual' check (source in ('manual','plaid','coinbase')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_accounts enable row level security;
create policy "finance_accounts_select_own" on public.finance_accounts for select using (auth.uid() = user_id);
create policy "finance_accounts_insert_own" on public.finance_accounts for insert with check (auth.uid() = user_id);
create policy "finance_accounts_update_own" on public.finance_accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "finance_accounts_delete_own" on public.finance_accounts for delete using (auth.uid() = user_id);

create trigger finance_accounts_set_updated_at before update on public.finance_accounts
  for each row execute function public.set_updated_at();

-- one snapshot per account per day for the sparkline
create table public.finance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.finance_accounts(id) on delete cascade,
  date date not null,
  value numeric(18,2) not null,
  created_at timestamptz not null default now(),
  unique (account_id, date)
);

alter table public.finance_snapshots enable row level security;
create policy "finance_snapshots_select_own" on public.finance_snapshots for select using (auth.uid() = user_id);
create policy "finance_snapshots_insert_own" on public.finance_snapshots for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.finance_accounts where id = account_id and user_id = auth.uid())
);
create policy "finance_snapshots_update_own" on public.finance_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "finance_snapshots_delete_own" on public.finance_snapshots for delete using (auth.uid() = user_id);

create index finance_snapshots_user_date_idx on public.finance_snapshots (user_id, date);
