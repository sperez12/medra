-- BORRADOR / NO EJECUTAR TODAVIA.
--
-- Este archivo documenta una posible tabla global futura para tasas de referencia.
-- No es una migracion lista para ejecutar.
-- No modifica public.exchange_rates.
-- No modifica public.manual_exchange_rates.
-- No borra datos.
-- No contiene operaciones destructivas.
--
-- Intencion futura:
-- - Guardar tasas Frankfurter / ECB compartidas para todos los usuarios.
-- - Usarlas solo para visualizacion/reportes.
-- - Mantener saldos originales sin modificar.
-- - Permitir lectura a usuarios autenticados.
-- - No permitir escrituras desde cliente.
-- - Escribir solo desde servidor en una fase futura, si se aprueba Opcion C.
--
-- Para convertir este borrador en migracion real, revisar primero:
-- - estrategia de RLS;
-- - endpoint /api/cron/exchange-rates/update;
-- - CRON_SECRET;
-- - uso server-side de SUPABASE_SERVICE_ROLE_KEY;
-- - pruebas locales y en Vercel.

/*
create table if not exists public.reference_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null,
  quote_currency text not null,
  rate numeric(18, 8) not null,
  rate_date date not null,
  source text not null default 'frankfurter',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reference_exchange_rates_supported_base_currency check (base_currency in ('MXN', 'USD', 'EUR', 'GBP', 'CAD', 'CHF', 'JPY')),
  constraint reference_exchange_rates_supported_quote_currency check (quote_currency in ('MXN', 'USD', 'EUR', 'GBP', 'CAD', 'CHF', 'JPY')),
  constraint reference_exchange_rates_different_currencies check (base_currency <> quote_currency),
  constraint reference_exchange_rates_positive_rate check (rate > 0),
  constraint reference_exchange_rates_supported_source check (source in ('frankfurter')),
  constraint reference_exchange_rates_unique_pair_date_source unique (base_currency, quote_currency, rate_date, source)
);

alter table public.reference_exchange_rates enable row level security;

create or replace function public.set_reference_exchange_rates_updated_at()
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
    where tgname = 'reference_exchange_rates_set_updated_at'
      and tgrelid = 'public.reference_exchange_rates'::regclass
  ) then
    create trigger reference_exchange_rates_set_updated_at
      before update on public.reference_exchange_rates
      for each row
      execute function public.set_reference_exchange_rates_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reference_exchange_rates'
      and policyname = 'Authenticated users can view reference exchange rates'
  ) then
    create policy "Authenticated users can view reference exchange rates"
      on public.reference_exchange_rates
      for select
      to authenticated
      using (true);
  end if;
end;
$$;

-- No crear politicas de insert/update para anon/authenticated.
-- En Opcion C, las escrituras deberian ocurrir solo desde servidor.
*/
