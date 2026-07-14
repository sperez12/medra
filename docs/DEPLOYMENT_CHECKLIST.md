# Deployment checklist para Vercel

Esta guia sirve para preparar el deploy de Patrimonio Personal en Vercel sin exponer secretos y sin cambiar los datos guardados en Supabase.

Importante: no pegues claves reales en archivos del proyecto. Las claves reales deben ir en las variables de entorno de Vercel y en tu archivo local `.env.local`, que no debe subirse a Git.

## Variables de entorno necesarias en Vercel

En Vercel, abre tu proyecto y entra a `Settings` > `Environment Variables`.

Agrega estas variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ALPHA_VANTAGE_API_KEY=
COINMARKETCAP_API_KEY=
TWELVE_DATA_API_KEY=
```

Notas:

- `NEXT_PUBLIC_SUPABASE_URL`: URL publica de tu proyecto de Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon public key de Supabase.
- `ALPHA_VANTAGE_API_KEY`: necesaria solo si quieres actualizar precios de acciones y ETFs.
- `COINMARKETCAP_API_KEY`: reservada para una fase futura.
- `TWELVE_DATA_API_KEY`: reservada para una fase futura.
- No uses `NEXT_PUBLIC` para claves privadas como Alpha Vantage, CoinMarketCap o Twelve Data.

## SQL que ya debe estar ejecutado en Supabase

Antes de publicar, confirma que ya ejecutaste los SQL necesarios para los modulos que usas:

- `docs/SUPABASE_SCHEMA.sql`
- `docs/SUPABASE_RLS.sql`
- `docs/ADD_CARD_PAYMENTS.sql`
- `docs/FIX_DUPLICATED_CATEGORIES.sql`
- `docs/ADD_ACCOUNTS.sql`
- `docs/ADD_PAYMENT_ACCOUNT_LINK.sql`
- `docs/ADD_ACCOUNT_TRANSFERS.sql`
- `docs/ADD_MULTI_CURRENCY_SUPPORT.sql`, si existe en tu rama local
- `docs/ADD_BUDGETS.sql`
- `docs/FIX_BUDGETS_CATEGORIES.sql`
- `docs/ADD_GOALS.sql`
- `docs/ADD_INVESTMENTS.sql`
- `docs/ADD_CRYPTO_PRICE_SUPPORT.sql`
- `docs/ADD_PRICE_PROVIDER_ARCHITECTURE.sql`
- `docs/FIX_DUPLICATED_ASSETS.sql`
- `docs/ADD_NET_WORTH_SNAPSHOTS.sql`
- `docs/ADD_MANUAL_EXCHANGE_RATES.sql`

Si un archivo no existe en tu proyecto, no lo ejecutes. Usa solo los archivos que estan presentes en la carpeta `docs`.

## Supabase Auth

Revisa esto en Supabase antes del deploy:

- En `Authentication` > `Providers`, confirma que Email este activo si usaras login con correo.
- En `Authentication` > `URL Configuration`, agrega la URL final de Vercel cuando ya exista.
- Agrega tambien la URL local para pruebas: `http://localhost:3000`.
- Si usas confirmacion por correo, prueba crear una cuenta nueva antes de publicar.

## Row Level Security

Revisa esto en Supabase:

- Las tablas de usuario deben tener RLS activo.
- Las politicas deben limitar lectura, creacion, edicion y borrado al usuario autenticado.
- Prueba con dos usuarios distintos si quieres confirmar que cada uno ve solo sus datos.

## Build local antes de publicar

Antes de hacer deploy, corre:

```bash
npm run build
```

Si el build falla, no publiques todavia. Corrige el error primero.

## Checklist manual antes del deploy

- [ ] `.env.local` no esta trackeado por Git.
- [ ] No hay claves reales en archivos trackeados.
- [ ] Variables de entorno configuradas en Vercel.
- [ ] Supabase URL configurada en Vercel.
- [ ] Supabase anon key configurada en Vercel.
- [ ] Alpha Vantage key configurada si se usaran precios de acciones/ETFs.
- [ ] SQL de tablas ejecutado en Supabase.
- [ ] SQL de RLS ejecutado en Supabase.
- [ ] RLS activo en tablas con datos del usuario.
- [ ] Login probado en local.
- [ ] Dashboard probado en local.
- [ ] Tarjetas, gastos y pagos probados en local.
- [ ] Cuentas, presupuestos y metas probados en local.
- [ ] Inversiones probado en local.
- [ ] Reportes probado en local.
- [ ] Build local correcto.

## Pruebas despues del deploy

Cuando publiques en Vercel, abre la URL final y prueba:

- Login y logout.
- Dashboard.
- Tarjetas, gastos y pagos.
- Cuentas y transferencias.
- Presupuestos.
- Metas y aportaciones.
- Inversiones manuales.
- Actualizacion de precios cripto con CoinGecko.
- Actualizacion de acciones/ETFs con Alpha Vantage, si configuraste la clave.
- Reportes, snapshots de patrimonio y tipos de cambio manuales.
- Vista movil desde el navegador del telefono.

## Riesgos comunes

- Si login no funciona en Vercel, revisa las URL permitidas en Supabase Auth.
- Si precios de acciones/ETFs fallan, revisa `ALPHA_VANTAGE_API_KEY` en Vercel.
- Si una pagina no carga datos, revisa que el SQL y las politicas RLS esten aplicadas.
- Si faltan datos en reportes consolidados, revisa que existan tipos de cambio manuales directos para la moneda base elegida.
