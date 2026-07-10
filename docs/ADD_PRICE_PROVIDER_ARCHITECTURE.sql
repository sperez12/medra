-- Arquitectura general de proveedores de precios.
-- Ejecuta este archivo en Supabase SQL Editor.
-- Es seguro para bases existentes: no borra datos y conserva compatibilidad con CoinGecko.

alter table public.assets
add column if not exists price_provider text not null default 'manual',
add column if not exists provider_asset_id text,
add column if not exists provider_symbol text,
add column if not exists last_price_error text;

update public.assets
set
  price_provider = coalesce(nullif(price_provider, 'manual'), price_source, 'manual'),
  provider_asset_id = coalesce(provider_asset_id, coingecko_id),
  provider_symbol = coalesce(provider_symbol, symbol)
where price_source = 'coingecko'
  and (price_provider = 'manual' or provider_asset_id is null or provider_symbol is null);

alter table public.assets
drop constraint if exists assets_price_provider_check;

alter table public.assets
add constraint assets_price_provider_check
check (price_provider in ('manual', 'coingecko', 'coinmarketcap', 'alpha_vantage', 'twelve_data'));

create index if not exists assets_price_provider_idx on public.assets(user_id, asset_type, price_provider);
create index if not exists assets_provider_asset_id_idx on public.assets(provider_asset_id);
create index if not exists assets_provider_symbol_idx on public.assets(provider_symbol);
