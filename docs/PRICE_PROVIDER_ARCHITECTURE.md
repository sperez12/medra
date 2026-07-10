# Arquitectura de proveedores de precios

La app ahora tiene una capa comun para actualizar precios sin depender de un solo proveedor.

## Proveedor activo

- CoinGecko: activo para activos tipo `crypto`.

## Proveedores preparados para fases futuras

- CoinMarketCap: preparado como stub, sin API key ni conexion real todavia.
- Alpha Vantage: preparado como stub, pensado para acciones, ETFs y fondos en una fase futura.
- Twelve Data: preparado como stub, pensado para acciones, ETFs y fondos en una fase futura.

## Campos principales en `assets`

- `current_price`: precio actual usado para calcular holdings.
- `price_source`: campo compatible con la primera version (`manual` o `coingecko`).
- `coingecko_id`: campo compatible con CoinGecko.
- `price_provider`: proveedor general (`manual`, `coingecko`, `coinmarketcap`, `alpha_vantage`, `twelve_data`).
- `provider_asset_id`: identificador usado por el proveedor.
- `provider_symbol`: simbolo usado por el proveedor.
- `last_price_updated_at`: ultima actualizacion correcta.
- `last_price_error`: ultimo error de actualizacion, si existio.

## Variables de entorno futuras

Estas claves seran privadas del servidor. No deben empezar con `NEXT_PUBLIC`.

- `COINMARKETCAP_API_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `TWELVE_DATA_API_KEY`

No agregues claves reales al repositorio.
