-- Preferencias configurables de alertas financieras por usuario para Medra.
-- Ejecuta este archivo una sola vez en Supabase SQL Editor.
-- Seguro: no borra datos existentes y no elimina tablas.

create table if not exists public.user_alert_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_payment_warning_days integer not null default 7,
  budget_warning_percent integer not null default 80,
  investment_stale_price_days integer not null default 7,
  low_balance_alert_enabled boolean not null default true,
  investment_price_alerts_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_alert_preferences_unique_user unique (user_id),
  constraint user_alert_preferences_card_days_range check (card_payment_warning_days between 1 and 30),
  constraint user_alert_preferences_budget_percent_range check (budget_warning_percent between 50 and 100),
  constraint user_alert_preferences_investment_days_range check (investment_stale_price_days between 1 and 30)
);

alter table public.user_alert_preferences enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_alert_preferences'
      and policyname = 'Users can view their own alert preferences'
  ) then
    create policy "Users can view their own alert preferences"
      on public.user_alert_preferences
      for select
      using (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_alert_preferences'
      and policyname = 'Users can insert their own alert preferences'
  ) then
    create policy "Users can insert their own alert preferences"
      on public.user_alert_preferences
      for insert
      with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_alert_preferences'
      and policyname = 'Users can update their own alert preferences'
  ) then
    create policy "Users can update their own alert preferences"
      on public.user_alert_preferences
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_alert_preferences'
      and policyname = 'Users can delete their own alert preferences'
  ) then
    create policy "Users can delete their own alert preferences"
      on public.user_alert_preferences
      for delete
      using (auth.uid() = user_id);
  end if;
end;
$$;

create or replace function public.set_user_alert_preferences_updated_at()
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
    select 1
    from pg_trigger
    where tgname = 'user_alert_preferences_set_updated_at'
      and tgrelid = 'public.user_alert_preferences'::regclass
  ) then
    create trigger user_alert_preferences_set_updated_at
      before update on public.user_alert_preferences
      for each row
      execute function public.set_user_alert_preferences_updated_at();
  end if;
end;
$$;
