# Tipos de cambio automaticos

Fase: v0.10.0-automatic-exchange-rates  
Fuente principal: Frankfurter / ECB
SQL: `docs/ADD_AUTOMATIC_EXCHANGE_RATES.sql`

Pulido: v0.10.1-automatic-exchange-rates-polish

## Objetivo

Medra usa tipos de cambio automaticos de referencia diaria como fuente principal para el reporte patrimonial consolidado.

Los tipos de cambio manuales quedan como datos legacy/respaldo tecnico. No se muestran en la interfaz principal de Reportes y no se borran.

Importante:

- No modifica saldos originales.
- No convierte cuentas, tarjetas, inversiones, metas, gastos ni snapshots.
- No borra tipos de cambio manuales existentes.
- No muestra gestion manual de tipos de cambio en la UI principal.
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

## Experiencia en Reportes

En `/reportes`, Medra muestra solo la gestion de tipos de cambio automaticos:

- moneda base seleccionada;
- fuente `Frankfurter / ECB`;
- fecha de referencia de la tasa mas reciente disponible;
- ultima actualizacion guardada;
- monedas disponibles para convertir hacia la moneda base;
- monedas faltantes, si alguna no tiene una tasa directa o inversa clara.

Si todavia no hay tasas guardadas, la seccion muestra un mensaje claro y mantiene visible el boton `Actualizar tipos de cambio`.

Si una moneda falta, Medra la excluye del total consolidado y muestra un aviso. Esto evita totales engañosos.

La moneda base sugerida viene de `preferred_currency`, pero si el usuario cambia la moneda base manualmente en Reportes, esa seleccion se respeta durante la sesion. No se modifica la preferencia guardada automaticamente.

Los tipos de cambio manuales quedan como legacy/respaldo tecnico. No se borran, pero ya no se muestran como experiencia principal.

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

La tabla es `public.exchange_rates`.

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

El SQL no borra datos existentes, no modifica `manual_exchange_rates` y no migra tasas manuales. La tabla `manual_exchange_rates` puede seguir existiendo como respaldo tecnico/historico, pero la interfaz principal usa `exchange_rates`.

## SQL a ejecutar

En Supabase:

1. Abre tu proyecto.
2. Ve a SQL Editor.
3. Abre el archivo local `docs/ADD_AUTOMATIC_EXCHANGE_RATES.sql`.
4. Copia todo el contenido.
5. Pegalo en SQL Editor.
6. Ejecuta el SQL una sola vez.
7. Confirma que la tabla `exchange_rates` existe y que RLS esta activo.

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

El resto de Reportes sigue visible. El reporte consolidado puede mostrar avisos de tasas faltantes hasta que existan tasas automaticas para la moneda base seleccionada.

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
8. El reporte patrimonial consolidado debe usar esas tasas automaticas.

## Como probar en produccion

1. Haz push del commit y espera el deploy de Vercel.
2. Ejecuta el SQL en Supabase si no lo has hecho.
3. Abre la URL de produccion.
4. Inicia sesion.
5. Ve a `/reportes`.
6. Actualiza tipos de cambio automaticos.
7. Revisa que el reporte consolidado use las tasas automaticas guardadas.
8. Revisa que no se modifiquen saldos, snapshots ni tasas manuales legacy.

## Como se calcula la conversion consolidada

La tabla guarda tasas como:

> 1 `base_currency` = `rate` `quote_currency`

Ejemplos:

- Si existe `USD -> MXN = 17.25` y se convierte USD a MXN, Medra multiplica.
- Si existe `MXN -> USD = 0.058` y se convierte USD a MXN, Medra divide en runtime.

La inversion solo ocurre en memoria para el reporte. No se guarda una tasa invertida en la base de datos.

Si no existe una tasa directa o inversa clara para convertir una moneda hacia la moneda base, Medra:

- muestra aviso de tasa faltante;
- excluye esa moneda del total consolidado;
- no inventa valores;
- no modifica saldos originales.

## Limitaciones actuales

- No hay actualizacion automatica programada.
- No hay Vercel Cron.
- No hay `CRON_SECRET`.
- No se usan estas tasas en saldos originales.
- No se guardan tasas invertidas automaticamente.
- No hay historico avanzado ni graficas.
- Si Frankfurter no responde, se muestra error amigable y no se rompe Reportes.

## Futuras fases recomendadas

1. Agregar Vercel Cron con `CRON_SECRET`.
2. Guardar snapshots consolidados usando fuente automatica, sin modificar snapshots originales por moneda.
3. Agregar auditoria visual de ultima tasa usada por moneda.
4. Evaluar fallback controlado si falta tasa directa/inversa, sin inventar conversiones silenciosas.
5. Decidir si los tipos manuales legacy se exportan, archivan visualmente o se eliminan de documentacion futura sin borrar datos.
