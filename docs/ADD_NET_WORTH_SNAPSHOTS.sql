-- Historial manual de patrimonio neto por moneda.
-- Ejecuta este archivo en Supabase SQL Editor antes de usar "Guardar snapshot de hoy".
-- Es seguro: no borra datos existentes.

create table if not exists public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  currency text not null,
  total_accounts numeric(20, 8) not null default 0,
  total_investments numeric(20, 8) not null default 0,
  pending_credit_cards numeric(20, 8) not null default 0,
  net_worth numeric(20, 8) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date, currency)
);

alter table public.net_worth_snapshots enable row level security;

drop policy if exists "Users can manage their net worth snapshots" on public.net_worth_snapshots;

create policy "Users can manage their net worth snapshots"
on public.net_worth_snapshots for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists net_worth_snapshots_user_date_idx
on public.net_worth_snapshots(user_id, snapshot_date desc);

create index if not exists net_worth_snapshots_user_currency_idx
on public.net_worth_snapshots(user_id, currency);
