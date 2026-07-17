-- Preferencias basicas por usuario para Medra.
-- Ejecuta este archivo una sola vez en Supabase SQL Editor.
-- No borra datos existentes.

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  preferred_currency text not null default 'MXN',
  date_format text not null default 'DD/MM/YYYY',
  default_dashboard_period text not null default 'current_period',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_unique_user unique (user_id),
  constraint user_preferences_supported_currency check (preferred_currency in ('MXN', 'USD', 'EUR', 'GBP', 'CAD', 'CHF', 'JPY')),
  constraint user_preferences_date_format check (date_format in ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  constraint user_preferences_dashboard_period check (default_dashboard_period in ('current_period', 'current_month', 'previous_month'))
);

alter table public.user_preferences enable row level security;

drop policy if exists "Users can view their own preferences" on public.user_preferences;
drop policy if exists "Users can insert their own preferences" on public.user_preferences;
drop policy if exists "Users can update their own preferences" on public.user_preferences;
drop policy if exists "Users can delete their own preferences" on public.user_preferences;

create policy "Users can view their own preferences"
  on public.user_preferences
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on public.user_preferences
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own preferences"
  on public.user_preferences
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_user_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row
  execute function public.set_user_preferences_updated_at();
