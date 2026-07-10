-- Soporte para precios automaticos de cripto con CoinGecko.
-- Ejecuta este archivo en Supabase SQL Editor antes de usar "Actualizar precios cripto".
-- Es seguro para bases existentes: no borra datos.

alter table public.assets
add column if not exists price_source text not null default 'manual',
add column if not exists coingecko_id text,
add column if not exists last_price_updated_at timestamptz;

alter table public.assets
drop constraint if exists assets_price_source_check;

alter table public.assets
add constraint assets_price_source_check
check (price_source in ('manual', 'coingecko'));

create index if not exists assets_price_source_idx on public.assets(user_id, asset_type, price_source);
create index if not exists assets_coingecko_id_idx on public.assets(coingecko_id);
