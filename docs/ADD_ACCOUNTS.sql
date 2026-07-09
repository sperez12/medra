-- Account module adjustments.
-- Run this once in Supabase SQL Editor before using /cuentas.

alter table public.accounts
add column if not exists description text;

alter table public.accounts
drop constraint if exists accounts_account_type_check;

alter table public.accounts
add constraint accounts_account_type_check
check (account_type in ('bank', 'cash', 'savings', 'manual_investment', 'other'));

create index if not exists accounts_user_id_idx
on public.accounts(user_id);

create index if not exists account_movements_account_id_idx
on public.account_movements(account_id);
