-- Add payment type support to existing credit card payments.
-- Run this once in Supabase SQL Editor before using the /pagos page.

alter table public.payments
add column if not exists payment_type text not null default 'other'
check (payment_type in ('minimum', 'partial', 'no_interest', 'total', 'other'));

create index if not exists payments_credit_card_id_idx
on public.payments(credit_card_id);

create index if not exists payments_payment_date_idx
on public.payments(payment_date);
