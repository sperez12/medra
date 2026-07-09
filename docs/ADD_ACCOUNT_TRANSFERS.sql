-- Add account transfers.
-- Safe to run more than once. It does not delete existing data.

create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id) on delete cascade,
  to_account_id uuid not null references public.accounts(id) on delete cascade,
  transfer_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'MXN',
  description text,
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

alter table public.account_movements
add column if not exists transfer_id uuid references public.account_transfers(id) on delete cascade;

create index if not exists account_transfers_user_id_idx
on public.account_transfers(user_id);

create index if not exists account_transfers_transfer_date_idx
on public.account_transfers(transfer_date);

create index if not exists account_movements_transfer_id_idx
on public.account_movements(transfer_id);

alter table public.account_transfers enable row level security;

drop policy if exists "Users can manage their account transfers" on public.account_transfers;

create policy "Users can manage their account transfers"
on public.account_transfers for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
