-- Link card payments to automatic account movements.
-- Run this once in Supabase SQL Editor before using account-linked payments.

alter table public.account_movements
add column if not exists payment_id uuid references public.payments(id) on delete cascade;

create unique index if not exists account_movements_payment_id_unique_idx
on public.account_movements(payment_id)
where payment_id is not null;

create index if not exists account_movements_payment_id_idx
on public.account_movements(payment_id);
