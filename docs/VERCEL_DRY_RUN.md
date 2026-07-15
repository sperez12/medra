# Dry run de deploy en Vercel

Esta guia es para preparar el deploy de Patrimonio Personal en Vercel sin publicar todavia. No modifica la base de datos, no ejecuta SQL y no requiere conectar cuentas desde el codigo.

Regla principal: las claves reales van en Vercel o en `.env.local`, nunca en archivos del proyecto.

## A. Variables de entorno para Vercel

Configura estas variables en Vercel desde `Project Settings` > `Environment Variables`.

| Variable | Obligatoria | Production | Preview | De donde se obtiene | Notas |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Si | Si | Recomendado | Supabase > Project Settings > API | Es publica, pero no la pegues en archivos del proyecto. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Si | Si | Recomendado | Supabase > Project Settings > API | Es la anon public key. RLS debe proteger los datos. |
| `ALPHA_VANTAGE_API_KEY` | Opcional | Si usas acciones/ETFs | Recomendado si pruebas previews | Alpha Vantage | Es privada. No debe llamarse `NEXT_PUBLIC`. |
| `COINMARKETCAP_API_KEY` | Opcional/futura | No necesaria ahora | No necesaria ahora | CoinMarketCap, en una fase futura | Reservada para futuro. La app actual no la usa. |
| `TWELVE_DATA_API_KEY` | Opcional/futura | No necesaria ahora | No necesaria ahora | Twelve Data, en una fase futura | Reservada para futuro. La app actual no la usa. |

Para este proyecto, las variables minimas para que la app funcione son:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Si quieres usar precios automaticos de acciones y ETFs, agrega tambien:

```env
ALPHA_VANTAGE_API_KEY=
```

No pegues valores reales en `.env.example`, README, docs ni codigo.

## B. Supabase Auth

Antes de publicar, revisa Supabase:

1. Entra a tu proyecto de Supabase.
2. Ve a `Authentication`.
3. Revisa que el proveedor de correo este activo si vas a entrar con email.
4. Ve a `URL Configuration`.
5. En `Site URL`, cuando tengas la URL final de Vercel, usa:

```text
https://TU-PROYECTO.vercel.app
```

6. En `Redirect URLs`, agrega al menos:

```text
https://TU-PROYECTO.vercel.app
http://localhost:3000
```

Si despues agregas un dominio propio, tambien debes agregarlo en Supabase Auth.

## C. Supabase Database

No corras SQL nuevo durante el deploy.

Antes de publicar, confirma que los SQL de las fases anteriores ya esten aplicados en Supabase. En este proyecto existen estos archivos SQL:

- `docs/SUPABASE_SCHEMA.sql`
- `docs/SUPABASE_RLS.sql`
- `docs/ADD_CARD_PAYMENTS.sql`
- `docs/FIX_DUPLICATED_CATEGORIES.sql`
- `docs/ADD_ACCOUNTS.sql`
- `docs/ADD_PAYMENT_ACCOUNT_LINK.sql`
- `docs/ADD_ACCOUNT_TRANSFERS.sql`
- `docs/ADD_BUDGETS.sql`
- `docs/FIX_BUDGETS_CATEGORIES.sql`
- `docs/ADD_GOALS.sql`
- `docs/ADD_INVESTMENTS.sql`
- `docs/ADD_CRYPTO_PRICE_SUPPORT.sql`
- `docs/ADD_PRICE_PROVIDER_ARCHITECTURE.sql`
- `docs/FIX_DUPLICATED_ASSETS.sql`
- `docs/ADD_NET_WORTH_SNAPSHOTS.sql`
- `docs/ADD_MANUAL_EXCHANGE_RATES.sql`

Revisa tambien que Row Level Security este activo. RLS es lo que evita que un usuario vea datos de otro usuario.

## D. Pasos manuales en Vercel

Cuando decidas publicar, estos son los pasos manuales:

1. Entra a Vercel.
2. Crea o importa un proyecto.
3. Elige el repositorio de Patrimonio Personal.
4. Verifica que Vercel detecte `Next.js` como framework.
5. Revisa el comando de build:

```bash
npm run build
```

6. Deja el output con el valor default de Next.js.
7. Agrega las variables de entorno antes de presionar `Deploy`.
8. Revisa que no hayas pegado claves en archivos del proyecto.
9. Revisa que Supabase Auth ya tenga la URL de Vercel en `Site URL` y `Redirect URLs`.
10. Solo cuando todo este revisado, presiona `Deploy`.

Este dry run no hace deploy. Es solo la preparacion.

## E. Prueba previa local

Antes de publicar, prueba localmente:

```bash
npm run build
npm run dev
```

Luego abre:

```text
http://localhost:3000
```

Prueba:

- Login y logout.
- Dashboard.
- Inversiones.
- Reportes.
- Vista movil.
- Crear un dato pequeno de prueba, si quieres confirmar escritura.

## F. Pruebas despues del deploy

Cuando ya publiques, abre la URL de Vercel:

```text
https://TU-PROYECTO.vercel.app
```

Prueba en este orden:

1. Login.
2. Logout.
3. Crear un dato pequeno de prueba.
4. Dashboard.
5. Tarjetas, gastos y pagos.
6. Cuentas.
7. Inversiones.
8. Actualizar precios cripto con CoinGecko.
9. Actualizar precios con Alpha Vantage si configuraste `ALPHA_VANTAGE_API_KEY`.
10. Reportes.
11. Vista movil desde el telefono.

## G. Problemas comunes

### Login redirige mal

Revisa Supabase Auth:

- `Site URL` debe apuntar a `https://TU-PROYECTO.vercel.app`.
- `Redirect URLs` debe incluir `https://TU-PROYECTO.vercel.app`.
- Para pruebas locales, conserva `http://localhost:3000`.

### Faltan variables

Si la app abre pero no carga datos, revisa en Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Despues de cambiar variables en Vercel, normalmente necesitas redeploy.

### Alpha Vantage falla

Revisa:

- Que `ALPHA_VANTAGE_API_KEY` exista en Vercel.
- Que no tenga espacios al inicio o final.
- Que no se haya alcanzado el limite de consultas.
- Que el activo use un ticker valido como `AAPL`, `MSFT`, `VOO` o `QQQ`.

### RLS bloquea datos

Si puedes entrar pero no ves datos:

- Confirma que las tablas existen.
- Confirma que RLS esta activo.
- Confirma que las politicas permiten al usuario autenticado ver sus propios datos.
- Prueba con un dato nuevo creado desde la app publicada.

### Build falla

Si `npm run build` falla localmente, no publiques todavia.

Si falla en Vercel pero local funciona:

- Revisa variables de entorno.
- Revisa que el repositorio tenga los archivos correctos.
- Revisa que no haya archivos locales sin commit.
- Revisa el log de build en Vercel.

### La app funciona local pero no en Vercel

Normalmente la causa esta en:

- Variables de entorno incompletas en Vercel.
- URL de Vercel no agregada en Supabase Auth.
- SQL o RLS incompleto en Supabase.
- Diferencia entre datos de prueba locales y datos reales en Supabase.

## Checklist final antes de publicar

- [ ] Build local correcto.
- [ ] `.env.local` no esta trackeado.
- [ ] No hay secretos en archivos trackeados.
- [ ] Variables de Supabase listas para Vercel.
- [ ] Alpha Vantage lista si se usara.
- [ ] Supabase Auth tiene Site URL y Redirect URLs correctas.
- [ ] SQL de fases anteriores ya aplicado.
- [ ] RLS revisado.
- [ ] Prueba movil local hecha.
- [ ] Decidiste conscientemente presionar `Deploy`.
