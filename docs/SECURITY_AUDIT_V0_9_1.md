# Auditoria de seguridad v0.9.1

Fecha: 2026-07-20  
App: Medra  
Checkpoint revisado: v0.9.0-alert-center-and-preferences

## Resumen ejecutivo

La app tiene una base defensiva razonablemente solida para una primera beta controlada:

- No se encontro uso de `service_role` en codigo, documentacion ni configuracion versionada.
- El cliente del navegador usa variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, que corresponden al cliente anonimo de Supabase.
- Las tablas principales documentadas incluyen `user_id` y las politicas RLS siguen el patron `auth.uid() = user_id`.
- El flujo de login evita open redirects basicos: `next` solo acepta rutas internas que empiezan con `/` y no con `//`.
- No se encontro `dangerouslySetInnerHTML`, `innerHTML`, `eval` ni construccion dinamica peligrosa de funciones en el frontend.
- `.env.local` esta ignorado por Git y no se encontro evidencia de secretos reales versionados en los patrones revisados.

No encontre riesgos criticos confirmados en el codigo local. Los puntos mas importantes antes de una beta son:

1. Proteger o limitar `/api/prices/validate`, porque hoy puede consultar proveedores externos sin validar sesion.
2. Agregar headers de seguridad conservadores en Next.js.
3. Revisar manualmente en Supabase que RLS este activo en todas las tablas reales de produccion.
4. Resolver la vulnerabilidad moderada transitiva reportada por auditoria de dependencias cuando Next/PostCSS tenga ruta de actualizacion segura.

## Alcance revisado

Se revisaron estas areas:

- SQL y RLS en `docs/*.sql`.
- Supabase client en `src/lib/supabase/client.ts`.
- Login, logout y proteccion de paginas en `src/components/auth/*` y rutas de `src/app`.
- Rutas API en `src/app/api/prices/update/route.ts`, `src/app/api/prices/validate/route.ts` y `src/app/api/crypto-prices/route.ts`.
- Formularios principales en componentes de tarjetas, gastos, pagos, cuentas, presupuestos, metas, inversiones, configuracion y alertas.
- Busqueda de usos peligrosos de HTML/JS en `src` y `docs`.
- Variables, secretos y placeholders en `.env.example`, README y documentacion de deploy.
- Configuracion de Next.js en `next.config.ts`.
- Auditoria de dependencias con `npm audit` y `pnpm audit`.

No se hizo deploy, no se ejecuto SQL, no se modifico la base de datos y no se imprimieron valores reales de `.env.local`.

## Hallazgos criticos

No se encontraron hallazgos criticos confirmados en esta pasada.

## Hallazgos altos

No se encontraron hallazgos altos confirmados en el codigo local.

Nota importante: si en Supabase produccion alguna tabla de usuario tuviera RLS desactivado, eso si seria un riesgo alto. La documentacion SQL revisada activa RLS, pero conviene verificarlo directamente en el dashboard de Supabase antes de beta.

## Hallazgos medios

### M1. `/api/prices/validate` no exige sesion

Archivo:

- `src/app/api/prices/validate/route.ts`

La ruta valida IDs de CoinGecko y simbolos de Alpha Vantage. No expone la API key de Alpha Vantage, pero hoy puede ser llamada por un usuario no autenticado. Esto podria consumir cuota de Alpha Vantage o facilitar abuso de la ruta.

Recomendacion:

- Exigir sesion para esta ruta, igual que en `src/app/api/prices/update/route.ts`.
- Para Alpha Vantage, validar con Supabase anon key + `Authorization` del usuario autenticado.
- Considerar rate limiting mas adelante si la app abre beta publica.

### M2. Falta configurar headers de seguridad en Next.js

Archivo:

- `next.config.ts`

Actualmente `next.config.ts` no define headers defensivos. No es un bug funcional, pero antes de beta conviene agregar headers conservadores.

Recomendacion inicial:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` restringiendo camara, microfono, geolocalizacion y otros permisos no usados.
- `X-Frame-Options: DENY` o una politica CSP con `frame-ancestors 'none'`.

Nota sobre CSP:

- Una Content Security Policy estricta puede romper Next.js, Supabase Auth o estilos/scripts si se agrega de golpe.
- Recomiendo agregar CSP en una fase separada, primero en modo conservador y probando login, dashboard, inversiones y reportes.

### M3. Proteccion de paginas principalmente client-side

Archivos:

- `src/components/auth/auth-guard.tsx`
- `src/components/app-shell.tsx`

Las paginas privadas usan `AuthGuard` en cliente. Esto evita mostrar el contenido final sin sesion y redirige a `/login`, pero la proteccion fuerte de datos depende de RLS y de que cada query valide usuario.

Estado actual:

- RLS y filtros `user_id` cubren la parte mas importante.
- La UI muestra estado de carga mientras revisa sesion.

Recomendacion:

- Mantener RLS como control principal.
- Evaluar middleware o proteccion server-side para rutas privadas en una fase futura, reduciendo flicker y endureciendo accesos directos.

### M4. Dependencias con version `latest`

Archivo:

- `package.json`

Las dependencias principales usan `"latest"`. Esto facilita arrancar, pero en produccion puede causar builds distintos entre dias si se reinstala desde cero.

Recomendacion:

- Antes de beta amplia, fijar versiones exactas o rangos controlados.
- Mantener `pnpm-lock.yaml` actualizado y revisado.
- Hacer actualizaciones de dependencias como fase controlada, con build y pruebas manuales.

## Hallazgos bajos

### B1. Mensajes de error tecnicos pueden llegar al usuario

Archivos:

- `src/app/api/prices/update/route.ts`
- `src/app/api/prices/validate/route.ts`
- Componentes que convierten errores de Supabase en mensajes de UI.

La app ya usa muchos mensajes amigables, pero algunas respuestas aun pueden incluir detalles como mensajes de Supabase o proveedor externo. No vi secretos expuestos, pero podria revelar detalles de esquema o proveedores.

Recomendacion:

- Mostrar mensajes genericos al usuario.
- Guardar detalles tecnicos solo en logs de servidor cuando exista una estrategia de logs segura.

### B2. `console.warn` con mensajes de Supabase en hooks de preferencias

Archivos:

- `src/lib/use-user-preferences.ts`
- `src/lib/use-user-alert-preferences.ts`

Los warnings ayudan en desarrollo y no imprimen secretos por si mismos, pero pueden revelar nombres de tablas o mensajes de schema cache en consola.

Recomendacion:

- Mantenerlos durante desarrollo.
- Antes de una beta publica, considerar mensajes mas genericos o logs solo en `process.env.NODE_ENV !== "production"`.

### B3. Algunas operaciones confian solo en RLS para borrar por `id`

Archivo:

- `src/components/reports/basic-reports.tsx`

Ejemplos observados:

- Borrado de snapshots: `delete().eq("id", snapshot.id)`.
- Borrado de tipos de cambio: `delete().eq("id", rate.id)`.

Con RLS correcto, otro usuario no podria borrar datos ajenos. Aun asi, por defensa en profundidad conviene agregar tambien `.eq("user_id", userId)` cuando el usuario autenticado ya esta disponible.

Recomendacion:

- En una fase pequeña posterior, agregar `user_id` a esos deletes sin cambiar UX ni calculos.

### B4. Scripts historicos de limpieza contienen `delete from`

Archivos:

- `docs/FIX_DUPLICATED_CATEGORIES.sql`
- `docs/FIX_BUDGETS_CATEGORIES.sql`
- `docs/FIX_DUPLICATED_ASSETS.sql`

Estos scripts fueron creados para limpiar duplicados de forma puntual y conservadora. No son un problema activo, pero contienen `delete from`, asi que no deben ejecutarse de nuevo sin revisar contexto y respaldos.

Recomendacion:

- Mantenerlos como historial de migracion.
- No incluirlos en pasos normales de deploy.
- Si se vuelven a usar, leerlos completos antes y confirmar que aplican al estado actual de datos.

## Supabase y RLS

### Lo que se ve bien

- `docs/SUPABASE_SCHEMA.sql` define tablas de usuario con `user_id uuid not null references auth.users(id) on delete cascade`, salvo `profiles`, que usa `id` como user id.
- `docs/SUPABASE_RLS.sql` activa RLS para tablas principales y crea politicas con `auth.uid() = user_id`.
- Migraciones nuevas revisadas tambien incluyen RLS:
  - `docs/ADD_USER_PREFERENCES.sql`
  - `docs/ADD_ALERT_PREFERENCES.sql`
  - `docs/ADD_MANUAL_EXCHANGE_RATES.sql`
  - `docs/ADD_NET_WORTH_SNAPSHOTS.sql`
  - `docs/ADD_GOALS.sql`
  - `docs/ADD_ACCOUNT_TRANSFERS.sql`
- No se encontro `service_role`.
- La ruta de actualizacion de precios usa anon key y valida sesion con `supabase.auth.getUser()`.

### Verificacion manual recomendada en Supabase

En Supabase, revisar que RLS este activo en estas tablas:

- `profiles`
- `categories`
- `credit_cards`
- `accounts`
- `expenses`
- `payments`
- `installment_purchases`
- `account_movements`
- `account_transfers`
- `platforms`
- `assets`
- `holdings`
- `investment_transactions`
- `asset_prices`
- `budgets`
- `goals`
- `goal_contributions`
- `financial_events`
- `net_worth_snapshots`
- `manual_exchange_rates`
- `user_preferences`
- `user_alert_preferences`

Tambien confirmar que cada tabla de usuario tenga politicas de `select`, `insert`, `update` y `delete` limitadas al usuario autenticado.

## Autenticacion

### Lo que se ve bien

- `/login` revisa sesion y redirige al usuario autenticado.
- El parametro `next` se normaliza con `getSafeNextPath`.
- `getSafeNextPath` ignora rutas que no empiezan con `/` o que empiezan con `//`, mitigando open redirects basicos.
- Logout usa `supabase.auth.signOut()` y redirige a `/login`.
- `/dashboard` redirige a `/`.

### Recomendacion futura

- Endurecer rutas privadas con middleware o proteccion server-side, manteniendo RLS como control principal de datos.

## API routes

### `/api/prices/update`

Archivo:

- `src/app/api/prices/update/route.ts`

Estado:

- Requiere header `Authorization`.
- Valida usuario con Supabase.
- Consulta `assets` con `.eq("user_id", userData.user.id)`.
- Actualiza assets con `.eq("id", ...)` y `.eq("user_id", userData.user.id)`.
- No expone la API key de Alpha Vantage.
- Conserva precio anterior si falla proveedor.

Riesgo bajo:

- Algunos detalles de error pueden llegar al cliente.

### `/api/prices/validate`

Archivo:

- `src/app/api/prices/validate/route.ts`

Estado:

- Valida proveedores, IDs y simbolos.
- Usa `ALPHA_VANTAGE_API_KEY` solo del lado servidor.
- No imprime ni devuelve la key.

Riesgo medio:

- No exige sesion.
- Puede consumir cuota de proveedor externo si alguien llama la ruta repetidamente.

## Variables y secretos

### Revisado

- `.env.example`
- `README.md`
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/VERCEL_DRY_RUN.md`
- `docs/PRICE_PROVIDER_ARCHITECTURE.md`
- Busqueda en archivos versionados con patrones de URLs Supabase, JWTs y `ALPHA_VANTAGE_API_KEY=...`

### Resultado

- `.env.local` no esta trackeado por Git.
- `.env.example` contiene variables vacias y comentarios seguros.
- No se encontraron valores reales de Supabase o Alpha Vantage en archivos versionados con los patrones revisados.
- `ALPHA_VANTAGE_API_KEY` no usa prefijo `NEXT_PUBLIC`.

## Validacion de datos

### Lo que se ve bien

Los formularios principales tienen validaciones basicas:

- Tarjetas: nombre, banco, ultimos 4 digitos, limite, corte, fecha limite, moneda.
- Gastos: tarjeta, monto, fecha, categoria, meses si aplica.
- Pagos: tarjeta, monto, fecha y cuenta origen opcional.
- Cuentas/movimientos/transferencias: montos positivos, moneda soportada, transferencias solo misma moneda.
- Presupuestos: categoria, monto limite, moneda, duplicados por categoria/mes/moneda.
- Metas: montos, moneda, cuenta compatible para aportaciones.
- Inversiones: plataformas, activos, holdings, transacciones, duplicados de activos y holdings.
- Configuracion: moneda soportada, formato de fecha y rangos de alertas.

### Recomendacion

- Mantener validacion frontend para UX.
- Mantener checks y RLS en base de datos como defensa final.
- En nuevas fases, agregar validaciones server-side cuando existan rutas API que reciban datos del usuario.

## Seguridad frontend

### Lo que se ve bien

- No se encontro `dangerouslySetInnerHTML`.
- No se encontro `innerHTML`.
- No se encontro `eval` ni `new Function`.
- No se encontraron logs de secretos.

### Recomendacion

- Mantener textos del usuario renderizados como texto normal de React.
- Evitar agregar HTML enriquecido sin sanitizacion.

## Headers y configuracion Next.js

Archivo:

- `next.config.ts`

Estado:

- Sin headers configurados.

Recomendacion:

- Agregar headers conservadores en una fase pequeña y probar:
  - login/logout
  - Supabase Auth redirects
  - Dashboard
  - Inversiones y precios
  - Reportes
  - Movil

## Dependencias

### `npm audit`

Resultado:

- No pudo ejecutarse porque el proyecto no tiene `package-lock.json`.
- El proyecto usa `pnpm-lock.yaml`.
- No se creo `package-lock.json`, porque eso modificaria el proyecto.

### `pnpm audit`

Resultado:

- Se ejecuto con red aprobada solo para consultar advisories.
- Resultado: 1 vulnerabilidad moderada.

Hallazgo:

- Paquete: `postcss`
- Severidad: moderada
- Rango vulnerable: `<8.5.10`
- Version corregida: `>=8.5.10`
- Ruta: `. > next > postcss`
- Advisory: `GHSA-qx2v-qp2m-jg93`
- Descripcion: XSS via unescaped `</style>` in CSS stringify output.

Recomendacion:

- No actualizar automaticamente en esta fase.
- Revisar si una actualizacion de Next resuelve `postcss`.
- Hacer esa actualizacion como fase controlada con build, pruebas visuales y pruebas de login/Supabase.

## Checklist de seguridad antes de beta

- [ ] Confirmar RLS activo en todas las tablas de usuario en Supabase.
- [ ] Probar manualmente con dos usuarios que no se vean datos entre cuentas.
- [ ] Confirmar que Vercel no tenga `service_role` configurado.
- [ ] Confirmar que `ALPHA_VANTAGE_API_KEY` este solo como variable privada, no `NEXT_PUBLIC`.
- [ ] Confirmar Redirect URLs en Supabase Auth para produccion y localhost.
- [ ] Proteger `/api/prices/validate` con sesion.
- [ ] Agregar headers de seguridad conservadores.
- [ ] Evaluar CSP en fase separada.
- [ ] Resolver vulnerabilidad moderada de `postcss` cuando haya ruta segura de actualizacion.
- [ ] Fijar versiones de dependencias antes de beta amplia.
- [ ] Revisar logs de Vercel para confirmar que no se imprimen datos sensibles.
- [ ] Revisar que los scripts historicos con `delete from` no formen parte del flujo normal de deploy.

## Checklist manual en Supabase y Vercel

Supabase:

- [ ] RLS activo en todas las tablas listadas.
- [ ] Politicas limitadas a `auth.uid() = user_id`.
- [ ] Auth Site URL apunta a la URL real de Vercel.
- [ ] Redirect URLs incluyen la URL real de Vercel y `http://localhost:3000`.
- [ ] SQL de fases previas ejecutado una sola vez y en orden.
- [ ] No usar service role en frontend ni Vercel.

Vercel:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurada.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurada.
- [ ] `ALPHA_VANTAGE_API_KEY` configurada solo si se usan precios de acciones/ETFs.
- [ ] `COINMARKETCAP_API_KEY` y `TWELVE_DATA_API_KEY` siguen vacias u omitidas si no se usan.
- [ ] Revisar logs despues de login, actualizacion de precios y reportes.
- [ ] Confirmar HTTPS y dominio correcto.

## Cosas que no se encontraron problematicas

- No se encontro `service_role`.
- No se encontraron secretos reales versionados con los patrones revisados.
- No se encontro `dangerouslySetInnerHTML`.
- No se encontro `eval`.
- No se encontro `new Function`.
- No se encontraron API keys privadas expuestas con `NEXT_PUBLIC`.
- La ruta de actualizacion de precios valida sesion y filtra por `user_id`.
- Las politicas RLS documentadas siguen un patron correcto por usuario.
- El login no acepta redirects externos obvios.
- La app conserva precios anteriores si fallan proveedores externos.

## Proximos pasos recomendados

Orden recomendado:

1. Crear una fase pequena para proteger `/api/prices/validate` con sesion.
2. Crear una fase pequena para agregar headers de seguridad conservadores.
3. Agregar `.eq("user_id", userId)` a deletes de reportes como defensa en profundidad.
4. Planear una fase de dependencias para resolver `postcss` via actualizacion segura de Next/PostCSS.
5. Hacer una prueba manual de aislamiento con dos usuarios antes de invitar beta testers.
