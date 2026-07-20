-- Automatic/reference exchange rates for reporting-only currency conversion.
-- These rates do not modify balances in accounts, cards, expenses, investments, goals, or snapshots.
-- Source for this first version: Frankfurter / ECB daily reference rates.

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  base_currency text not null,
  quote_currency text not null,
  rate numeric(18, 8) not null,
  rate_date date not null,
  source text not null default 'frankfurter',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exchange_rates_supported_base_currency check (base_currency in ('MXN', 'USD', 'EUR', 'GBP', 'CAD', 'CHF', 'JPY')),
  constraint exchange_rates_supported_quote_currency check (quote_currency in ('MXN', 'USD', 'EUR', 'GBP', 'CAD', 'CHF', 'JPY')),
  constraint exchange_rates_different_currencies check (base_currency <> quote_currency),
  constraint exchange_rates_positive_rate check (rate > 0),
  constraint exchange_rates_supported_source check (source in ('frankfurter')),
  constraint exchange_rates_unique_user_pair_date_source unique (user_id, base_currency, quote_currency, rate_date, source)
);

alter table public.exchange_rates enable row level security;

create or replace function public.set_exchange_rates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'exchange_rates_set_updated_at'
      and tgrelid = 'public.exchange_rates'::regclass
  ) then
    create trigger exchange_rates_set_updated_at
      before update on public.exchange_rates
      for each row
      execute function public.set_exchange_rates_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exchange_rates'
      and policyname = 'Users can view their own automatic exchange rates'
  ) then
    create policy "Users can view their own automatic exchange rates"
      on public.exchange_rates
      for select
      using (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exchange_rates'
      and policyname = 'Users can create their own automatic exchange rates'
  ) then
    create policy "Users can create their own automatic exchange rates"
      on public.exchange_rates
      for insert
      with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exchange_rates'
      and policyname = 'Users can update their own automatic exchange rates'
  ) then
    create policy "Users can update their own automatic exchange rates"
      on public.exchange_rates
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exchange_rates'
      and policyname = 'Users can delete their own automatic exchange rates'
  ) then
    create policy "Users can delete their own automatic exchange rates"
      on public.exchange_rates
      for delete
      using (auth.uid() = user_id);
  end if;
end;
$$;
