-- Manual exchange rates for reporting-only currency conversion.
-- This does not modify balances in accounts, cards, expenses, investments, goals, or snapshots.

create table if not exists public.manual_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rate_date date not null,
  from_currency text not null,
  to_currency text not null,
  rate numeric(18, 8) not null check (rate > 0),
  notes text,
  created_at timestamptz not null default now(),
  constraint manual_exchange_rates_different_currencies check (upper(from_currency) <> upper(to_currency))
);

create unique index if not exists manual_exchange_rates_unique_user_date_pair
  on public.manual_exchange_rates (
    user_id,
    rate_date,
    upper(from_currency),
    upper(to_currency)
  );

alter table public.manual_exchange_rates enable row level security;

drop policy if exists "Users can view their own manual exchange rates" on public.manual_exchange_rates;
create policy "Users can view their own manual exchange rates"
  on public.manual_exchange_rates
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own manual exchange rates" on public.manual_exchange_rates;
create policy "Users can create their own manual exchange rates"
  on public.manual_exchange_rates
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own manual exchange rates" on public.manual_exchange_rates;
create policy "Users can update their own manual exchange rates"
  on public.manual_exchange_rates
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own manual exchange rates" on public.manual_exchange_rates;
create policy "Users can delete their own manual exchange rates"
  on public.manual_exchange_rates
  for delete
  using (auth.uid() = user_id);
