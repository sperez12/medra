-- Limpieza conservadora de activos duplicados y bloqueo de duplicados futuros.
--
-- Modelo correcto:
-- Un activo es unico por usuario + simbolo normalizado + tipo + moneda normalizada.
-- Si tienes el mismo activo en varias plataformas, usa holdings separados.
--
-- Este script:
-- 1. Crea una tabla temporal con grupos duplicados.
-- 2. Elige un activo principal por grupo.
-- 3. Reasigna transacciones de activos duplicados al activo principal.
-- 4. Reasigna holdings solo cuando no existe ya un holding para la misma plataforma y activo principal.
-- 5. No borra holdings ni transacciones.
-- 6. Borra activos duplicados solo si ya no tienen holdings ni transacciones.
-- 7. Crea un indice unico solo si ya no quedan duplicados.
--
-- Si quedan duplicados con holdings en la misma plataforma, el script se detiene antes
-- de crear el indice unico. En ese caso revisa los duplicados manualmente en la app.

begin;

create temp table duplicated_assets_to_fix as
with normalized_assets as (
  select
    id,
    user_id,
    upper(trim(symbol)) as normalized_symbol,
    asset_type,
    upper(trim(currency)) as normalized_currency,
    created_at,
    row_number() over (
      partition by user_id, upper(trim(symbol)), asset_type, upper(trim(currency))
      order by created_at asc, id asc
    ) as duplicate_rank,
    first_value(id) over (
      partition by user_id, upper(trim(symbol)), asset_type, upper(trim(currency))
      order by created_at asc, id asc
    ) as primary_asset_id,
    count(*) over (
      partition by user_id, upper(trim(symbol)), asset_type, upper(trim(currency))
    ) as duplicate_count
  from public.assets
)
select *
from normalized_assets
where duplicate_count > 1;

-- Reasignar transacciones al activo principal.
update public.investment_transactions transaction
set asset_id = duplicated.primary_asset_id
from duplicated_assets_to_fix duplicated
where transaction.asset_id = duplicated.id
  and duplicated.duplicate_rank > 1;

-- Reasignar holdings solo si no crea duplicado de plataforma + activo.
update public.holdings holding
set asset_id = duplicated.primary_asset_id
from duplicated_assets_to_fix duplicated
where holding.asset_id = duplicated.id
  and duplicated.duplicate_rank > 1
  and not exists (
    select 1
    from public.holdings existing
    where existing.user_id = holding.user_id
      and existing.platform_id = holding.platform_id
      and existing.asset_id = duplicated.primary_asset_id
  );

-- Borrar solo activos duplicados que ya no tienen referencias.
delete from public.assets asset
using duplicated_assets_to_fix duplicated
where asset.id = duplicated.id
  and duplicated.duplicate_rank > 1
  and not exists (
    select 1 from public.holdings holding where holding.asset_id = asset.id
  )
  and not exists (
    select 1 from public.investment_transactions transaction where transaction.asset_id = asset.id
  )
  and not exists (
    select 1 from public.asset_prices price where price.asset_id = asset.id
  );

-- Si todavia quedan duplicados, detener antes de crear el indice unico.
do $$
begin
  if exists (
    select 1
    from public.assets
    group by user_id, upper(trim(symbol)), asset_type, upper(trim(currency))
    having count(*) > 1
  ) then
    raise exception 'Todavia quedan activos duplicados con referencias. No se creo el indice unico. Revisa y fusiona manualmente los duplicados restantes en la app.';
  end if;
end $$;

create unique index if not exists assets_user_symbol_type_currency_unique_idx
on public.assets (user_id, upper(trim(symbol)), asset_type, upper(trim(currency)));

commit;
