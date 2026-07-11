-- transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.finance_accounts(id) on delete set null,
  occurred_at timestamptz not null default now(),
  name text not null,
  amount numeric not null, -- positive = inflow, negative = outflow
  category text not null default '',
  method text not null default '' , -- CARD / ACH / WIRE / '' (ledger tag)
  source text not null default 'manual' check (source in ('manual','plaid','agent')),
  external_id text,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
create policy "transactions_select_own" on public.transactions for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_delete_own" on public.transactions for delete using (auth.uid() = user_id);

create index transactions_user_occurred_idx on public.transactions (user_id, occurred_at desc);

-- budgets (monthly spend budget)
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null, -- first of month
  amount numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

alter table public.budgets enable row level security;
create policy "budgets_select_own" on public.budgets for select using (auth.uid() = user_id);
create policy "budgets_insert_own" on public.budgets for insert with check (auth.uid() = user_id);
create policy "budgets_update_own" on public.budgets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "budgets_delete_own" on public.budgets for delete using (auth.uid() = user_id);
