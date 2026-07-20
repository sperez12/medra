# Tipos de cambio automaticos

Fase: v0.10.0-automatic-exchange-rates  
Fuente inicial: Frankfurter / ECB  
SQL pendiente: `docs/ADD_AUTOMATIC_EXCHANGE_RATES.sql`

## Objetivo

Medra ya permite guardar tipos de cambio manuales para reportes patrimoniales consolidados. Esta fase agrega una segunda capa: tipos de cambio automaticos de referencia diaria.

Importante:

- No modifica saldos originales.
- No convierte cuentas, tarjetas, inversiones, metas, gastos ni snapshots.
- No reemplaza los tipos de cambio manuales.
- No crea cron jobs.
- No usa API keys.
- No usa `service_role`.

## Fuente

Se usa Frankfurter API con datos de referencia de ECB.

- Sitio/documentacion: https://frankfurter.dev/
- Endpoint usado: `https://api.frankfurter.dev/v2/rates`
- Parametros usados:
  - `base`: moneda base seleccionada.
  - `quotes`: monedas destino soportadas por Medra.
  - `providers=ECB`: limita la fuente a referencia ECB cuando esta disponible.

Estas tasas son referencias diarias, no precios de mercado en tiempo real. Pueden actualizarse cuando ECB/Frankfurter publica datos del dia habil mas reciente.

## Monedas soportadas

Por ahora se usan las mismas monedas soportadas por Medra:

- MXN
- USD
- EUR
- GBP
- CAD
- CHF
- JPY

## Base de datos

La nueva tabla propuesta es `public.exchange_rates`.

Campos principales:

- `user_id`: usuario propietario.
- `base_currency`: moneda base.
- `quote_currency`: moneda destino.
- `rate`: tasa.
- `rate_date`: fecha de referencia de la tasa.
- `source`: fuente, por ahora `frankfurter`.
- `fetched_at`: fecha/hora en que Medra guardo la tasa.

Restriccion importante:

- Solo puede existir una tasa por usuario + moneda base + moneda destino + fecha + fuente.

## SQL a ejecutar

En Supabase:

1. Abre tu proyecto.
2. Ve a SQL Editor.
3. Abre el archivo local `docs/ADD_AUTOMATIC_EXCHANGE_RATES.sql`.
4. Copia todo el contenido.
5. Pegalo en SQL Editor.
6. Ejecuta el SQL una sola vez.
7. Confirma que la tabla `exchange_rates` existe y que RLS esta activo.

El SQL no borra datos existentes, no modifica `manual_exchange_rates` y no migra tasas manuales.

## Seguridad

La ruta interna `src/app/api/exchange-rates/update/route.ts`:

- exige sesion valida;
- usa Supabase anon key mas `Authorization` del usuario;
- consulta Frankfurter solo despues de validar sesion;
- guarda tasas con `user_id` del usuario autenticado;
- depende de RLS para que cada usuario vea y edite solo sus propias tasas;
- no usa llaves privadas ni service role.

## Comportamiento si el SQL no se ha ejecutado

La app sigue funcionando.

En `/reportes`, la seccion "Tipos de cambio automaticos" mostrara:

> Para guardar tipos de cambio automaticos, ejecuta la migracion pendiente.

Los reportes manuales y el patrimonio consolidado con tasas manuales siguen funcionando.

## Como probar antes de ejecutar SQL

1. Ejecuta la app local.
2. Inicia sesion.
3. Ve a `/reportes`.
4. Busca "Tipos de cambio automaticos".
5. Presiona "Actualizar tipos de cambio".
6. Debe aparecer un mensaje indicando que falta ejecutar la migracion pendiente.
7. El resto de Reportes debe seguir visible y funcional.

## Como probar despues de ejecutar SQL

1. Ejecuta `docs/ADD_AUTOMATIC_EXCHANGE_RATES.sql` en Supabase.
2. Reinicia la app local si hace falta.
3. Inicia sesion.
4. Ve a `/reportes`.
5. En "Tipos de cambio automaticos", elige una moneda base, por ejemplo MXN o USD.
6. Presiona "Actualizar tipos de cambio".
7. Debes ver:
   - fuente Frankfurter / ECB;
   - fecha de tasa;
   - ultima actualizacion;
   - tasas disponibles para la moneda base seleccionada.

## Como probar en produccion

1. Haz push del commit y espera el deploy de Vercel.
2. Ejecuta el SQL en Supabase si no lo has hecho.
3. Abre la URL de produccion.
4. Inicia sesion.
5. Ve a `/reportes`.
6. Actualiza tipos de cambio automaticos.
7. Revisa que no se modifiquen saldos, snapshots ni tasas manuales.

## Limitaciones actuales

- No hay actualizacion automatica programada.
- No hay Vercel Cron.
- No hay `CRON_SECRET`.
- No se usan estas tasas en el calculo consolidado todavia.
- No se invierten tasas automaticamente.
- No hay historico avanzado ni graficas.
- Si Frankfurter no responde, se muestra error amigable y no se rompe Reportes.

## Futuras fases recomendadas

1. Permitir elegir en reportes consolidados entre tasas manuales y automaticas.
2. Agregar Vercel Cron con `CRON_SECRET`.
3. Guardar snapshots consolidados usando fuente seleccionada, sin modificar snapshots originales.
4. Agregar auditoria visual de ultima tasa usada por moneda.
5. Evaluar fallback si falta tasa directa, sin inventar conversiones silenciosas.
