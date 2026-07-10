-- Inversiones manuales
-- Ejecuta este archivo en Supabase SQL Editor antes de probar /inversiones.
-- Es seguro para bases existentes: no borra datos y solo completa columnas/restricciones.

alter table public.platforms
add column if not exists country text,
add column if not exists description text;

alter table public.platforms
drop constraint if exists platforms_platform_type_check;

alter table public.platforms
add constraint platforms_platform_type_check
check (platform_type in ('broker', 'crypto_exchange', 'wallet', 'bank', 'retirement', 'other'));

alter table public.assets
add column if not exists current_price numeric(20, 8) not null default 0,
add column if not exists description text,
add column if not exists is_active boolean not null default true;

alter table public.assets
drop constraint if exists assets_asset_type_check;

alter table public.assets
add constraint assets_asset_type_check
check (asset_type in ('crypto', 'stock', 'etf', 'fund', 'bond', 'investment_cash', 'other'));

alter table public.holdings
add column if not exists notes text;

alter table public.holdings
alter column average_cost drop not null;

alter table public.holdings
drop constraint if exists holdings_quantity_check;

alter table public.holdings
add constraint holdings_quantity_check check (quantity >= 0);

alter table public.investment_transactions
add column if not exists total_amount numeric(20, 8) not null default 0,
add column if not exists description text;

alter table public.investment_transactions
drop constraint if exists investment_transactions_transaction_type_check;

alter table public.investment_transactions
add constraint investment_transactions_transaction_type_check
check (transaction_type in ('buy', 'sell', 'dividend', 'interest', 'deposit', 'withdrawal', 'adjustment'));

alter table public.investment_transactions
drop constraint if exists investment_transactions_quantity_check;

alter table public.investment_transactions
add constraint investment_transactions_quantity_check check (quantity >= 0);

create index if not exists platforms_user_id_idx on public.platforms(user_id);
create index if not exists assets_user_id_idx on public.assets(user_id);
create index if not exists holdings_user_id_idx on public.holdings(user_id);
create index if not exists investment_transactions_user_id_idx on public.investment_transactions(user_id);
create index if not exists investment_transactions_transaction_date_idx on public.investment_transactions(transaction_date);
