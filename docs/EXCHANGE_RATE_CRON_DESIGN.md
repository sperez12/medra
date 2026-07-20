# Diseno de cron para tipos de cambio

Fase: v0.10.2-exchange-rate-cron-design  
Estado: diseno y preparacion. No activa cron.

Implementacion parcial posterior: v0.10.3-exchange-rate-lazy-refresh

## Resumen ejecutivo

Medra ya puede actualizar tipos de cambio desde Frankfurter / ECB en `/reportes`, pero esa actualizacion es manual y requiere una sesion de usuario.

Para una actualizacion diaria automatica con Vercel Cron, no conviene reutilizar directamente el flujo actual, porque un cron no tiene sesion de usuario. La opcion mas segura para una automatizacion real futura es separar las tasas de referencia globales de las tasas guardadas por usuario.

Recomendacion para Medra ahora:

1. Mantener funcionando la actualizacion manual actual.
2. Como siguiente paso practico, implementar "lazy refresh" autenticado: cuando el usuario abre Reportes, Medra detecta si las tasas estan viejas y ofrece actualizarlas o las refresca usando la sesion del usuario.
3. Dejar el cron global real para una fase posterior, con diseno, pruebas y secretos de servidor bien controlados.

Esta fase no agrega cron, no agrega secretos, no usa `service_role`, no modifica base de datos y no cambia calculos financieros.

En `v0.10.3`, Medra implementa la primera version de Opcion B como aviso conservador mas boton autenticado. No hace auto-refresh en segundo plano todavia.

## Estado actual

- `/reportes` usa `public.exchange_rates` como fuente principal para patrimonio consolidado visual.
- `public.exchange_rates` tiene `user_id`.
- La actualizacion manual vive en `src/app/api/exchange-rates/update/route.ts`.
- Ese endpoint exige sesion valida.
- El cliente envia `Authorization: Bearer <access_token>`.
- El servidor usa Supabase anon key mas el token del usuario.
- RLS limita lectura/escritura a `auth.uid() = user_id`.
- No hay Vercel Cron.
- No hay `CRON_SECRET`.
- No hay `SUPABASE_SERVICE_ROLE_KEY`.
- No se modifican saldos originales.
- No se borran tasas manuales legacy.

## Problema: cron sin sesion de usuario

Un Vercel Cron ejecuta una ruta programada del proyecto, pero no representa a un usuario autenticado de Supabase.

Eso crea una tension con la tabla actual:

- `exchange_rates` exige `user_id`.
- Las politicas RLS permiten escribir solo si `auth.uid() = user_id`.
- Un cron no tiene `auth.uid()` de un usuario final.
- Forzar al cron a escribir una copia por cada usuario seria mas complejo, mas caro y mas riesgoso.

Tampoco conviene guardar tasas Frankfurter / ECB duplicadas por usuario para automatizacion global, porque son tasas de referencia iguales para todos. Si la fuente es global, la tabla tambien deberia ser global.

## Por que no conviene que cron actualice tasas por usuario

Actualizar por usuario implicaria:

- listar usuarios o perfiles;
- escribir N copias de las mismas tasas;
- usar credenciales de servidor con mucho cuidado;
- manejar usuarios nuevos, usuarios inactivos y monedas preferidas;
- aumentar superficie de error;
- crear mas filas de las necesarias;
- mezclar una tarea global con datos de usuario.

Para Medra, una tabla global de tasas de referencia seria mas clara:

- una tasa Frankfurter / ECB por par, fecha y fuente;
- todos los usuarios leen la misma referencia;
- no se tocan saldos ni movimientos de usuarios;
- el cron solo actualiza datos publicos/de referencia;
- la app conserva privacidad porque los patrimonios y reportes siguen siendo por usuario.

## Opciones de diseno

### Opcion A: mantener solo actualizacion manual autenticada

Descripcion:

- Se mantiene el flujo actual.
- El usuario entra a `/reportes` y presiona `Actualizar tipos de cambio`.
- La app guarda tasas en `exchange_rates` para ese usuario.

Ventajas:

- Es lo mas simple.
- No requiere cron.
- No requiere secretos nuevos.
- No requiere `service_role`.
- Sigue protegido por RLS actual.

Desventajas:

- No es actualizacion automatica real.
- Cada usuario debe actualizar sus propias tasas.
- Puede haber tasas viejas si el usuario no presiona el boton.

Riesgo:

- Bajo.

### Opcion B: lazy refresh autenticado

Descripcion:

- Al abrir `/reportes`, Medra revisa si las tasas guardadas estan viejas.
- Si estan viejas, muestra un aviso claro o ejecuta una actualizacion con la sesion del usuario.
- Sigue usando el endpoint autenticado actual.
- No requiere cron.

Ventajas:

- Mantiene la seguridad actual.
- No requiere `service_role`.
- No requiere `CRON_SECRET`.
- Da sensacion de automatizacion ligera.
- Reduce la friccion para el usuario.

Desventajas:

- Solo se actualiza cuando un usuario usa la app.
- Si nadie abre Reportes, no hay actualizacion.
- Cada usuario puede seguir teniendo sus propias tasas guardadas.

Riesgo:

- Bajo a medio, segun si se actualiza automaticamente o solo se ofrece actualizar.

Recomendacion de implementacion:

- Primero mostrar aviso: "Tus tipos de cambio parecen antiguos. Actualizalos para tener reportes mas recientes."
- Despues, si la experiencia es buena, evaluar auto-refresh con sesion al abrir Reportes.

### Opcion C: cron global real

Descripcion:

- Crear una tabla global futura, por ejemplo `public.reference_exchange_rates`, sin `user_id`.
- Guardar tasas Frankfurter / ECB compartidas para todos.
- Crear endpoint protegido: `/api/cron/exchange-rates/update`.
- Vercel Cron llama ese endpoint diariamente.
- El endpoint valida `Authorization: Bearer ${CRON_SECRET}`.
- Si pasa la validacion, consulta Frankfurter y guarda tasas globales.
- En una fase futura, la app lee tasas globales para reportes.

Ventajas:

- Actualizacion diaria real.
- No duplica tasas por usuario.
- Mejor separacion entre datos globales de referencia y datos privados.
- Escala mejor.

Desventajas:

- Requiere una migracion nueva.
- Requiere secretos de servidor.
- Probablemente requiere `SUPABASE_SERVICE_ROLE_KEY` solo del lado servidor para escribir la tabla global.
- Requiere mas pruebas de seguridad.
- Requiere estrategia de fallback y observabilidad.

Riesgo:

- Medio si se implementa con cuidado.
- Alto si se expone `service_role`, se valida mal el cron o se mezclan datos de usuario.

## Recomendacion

Para Medra ahora, conviene seguir con Opcion B como siguiente paso practico.

Motivo:

- Da una mejora real de experiencia sin introducir secretos nuevos.
- Mantiene RLS y sesion de usuario como proteccion principal.
- No cambia base de datos.
- No toca saldos ni calculos financieros base.
- Permite validar la experiencia antes de operar una tarea programada global.

La Opcion C conviene mas adelante, cuando queramos cron diario real y estemos listos para:

- crear tabla global;
- agregar `CRON_SECRET`;
- agregar `SUPABASE_SERVICE_ROLE_KEY` solo en servidor;
- crear endpoint de cron;
- probar local y en Vercel;
- documentar rollback.

## Diseno futuro de cron real

Endpoint sugerido:

```text
/api/cron/exchange-rates/update
```

Metodo recomendado:

- `GET`, porque Vercel Cron invoca rutas programadas como solicitudes HTTP simples.
- Se puede considerar `POST` para pruebas internas, pero no es necesario para la primera version.

Validacion:

```text
Authorization: Bearer ${CRON_SECRET}
```

Reglas:

- Si falta `CRON_SECRET`, fallar cerrado con `401`.
- Si falta `Authorization`, responder `401`.
- Si `Authorization` no coincide exactamente con `Bearer ${CRON_SECRET}`, responder `401`.
- No consultar Frankfurter si la autenticacion falla.
- No devolver secretos.
- No exponer detalles internos sensibles.
- Mantener logs minimos y seguros.

Flujo futuro:

1. Validar `CRON_SECRET`.
2. Definir monedas soportadas.
3. Consultar Frankfurter / ECB para una o varias monedas base.
4. Validar monedas, tasa positiva y fecha.
5. Guardar tasas en tabla global.
6. Conservar tasas anteriores si Frankfurter falla.
7. No borrar tasas antiguas en la primera version.
8. Responder resumen simple: fuente, fecha, cantidad de tasas actualizadas.

Concurrencia:

- Pendiente para fase futura.
- Si Vercel ejecuta dos solicitudes cercanas, la restriccion unica de la tabla debe evitar duplicados.
- Se puede evaluar un lock ligero o upsert idempotente.

## Tabla global futura

Nombre sugerido:

```text
public.reference_exchange_rates
```

Campos sugeridos:

- `id`
- `base_currency`
- `quote_currency`
- `rate`
- `rate_date`
- `source`
- `fetched_at`
- `created_at`
- `updated_at`

Unicidad sugerida:

```text
unique(base_currency, quote_currency, rate_date, source)
```

RLS sugerido:

- Activar RLS.
- Permitir `select` a usuarios autenticados.
- No permitir `insert`, `update` ni `delete` desde clientes anon/authenticated.
- Las escrituras del cron se harian solo desde servidor con una clave privada, si se aprueba la Opcion C.

Archivo de borrador:

- `docs/DRAFT_GLOBAL_EXCHANGE_RATES.sql`
- Esta marcado como `BORRADOR / NO EJECUTAR TODAVIA`.
- No modifica tablas existentes.
- No toca `exchange_rates`.
- No toca `manual_exchange_rates`.

## Variables futuras

Solo si se implementa Opcion C:

```text
CRON_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

Reglas:

- Nunca deben ser `NEXT_PUBLIC`.
- Nunca deben imprimirse en logs.
- Nunca deben agregarse a archivos versionados.
- Deben configurarse solo en Vercel como variables privadas de servidor.
- `SUPABASE_SERVICE_ROLE_KEY` debe usarse solo en rutas server-side.

## Riesgos de seguridad

Riesgos principales:

- Exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente.
- Validar mal `CRON_SECRET`.
- Consultar Frankfurter antes de autenticar la ruta cron.
- Permitir escritura directa de tasas globales desde navegador.
- Mezclar datos globales de referencia con datos privados de usuarios.
- Mostrar errores tecnicos sensibles en respuestas publicas.

Mitigaciones:

- Fallar cerrado si falta secreto.
- Validar `Authorization` antes de cualquier trabajo.
- Mantener el endpoint cron fuera de la UI.
- Usar mensajes genericos.
- Mantener RLS activo.
- No crear politicas de escritura para clientes.
- Revisar logs para que no incluyan secretos.

## Pasos futuros para implementar Opcion B

Estado: primera version implementada en `v0.10.3-exchange-rate-lazy-refresh`.

1. Calcular antiguedad de tasas en `/reportes`.
2. Definir umbral, por ejemplo 24 o 36 horas.
3. Mostrar aviso si estan viejas.
4. Ofrecer boton "Actualizar ahora".
5. Opcional: auto-refresh autenticado con sesion, despues de probar el aviso manual.
6. Mantener `preferred_currency` como moneda base sugerida.
7. No modificar preferencias automaticamente desde Reportes.

## Pasos futuros para implementar Opcion C

1. Revisar y aprobar el modelo global.
2. Convertir `docs/DRAFT_GLOBAL_EXCHANGE_RATES.sql` en migracion real.
3. Ejecutar la migracion en Supabase.
4. Agregar variables privadas en Vercel:
   - `CRON_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Crear endpoint `/api/cron/exchange-rates/update`.
6. Probar autenticacion local con token falso y token correcto.
7. Probar que sin secreto no consulta Frankfurter.
8. Probar que conserva tasas anteriores si Frankfurter falla.
9. Cambiar Reportes para leer primero tasas globales.
10. Agregar `vercel.json` con cron solo cuando todo lo anterior este probado.

## Pruebas locales futuras

Antes de activar cron:

1. Ejecutar build local.
2. Confirmar que `/reportes` sigue funcionando con tasas actuales por usuario.
3. Probar endpoint cron sin `CRON_SECRET`: debe responder `401`.
4. Probar endpoint cron sin `Authorization`: debe responder `401`.
5. Probar endpoint cron con token incorrecto: debe responder `401`.
6. Probar endpoint cron con token correcto: debe actualizar tasas globales.
7. Confirmar que no cambia saldos originales.
8. Confirmar que no toca `exchange_rates` por usuario salvo que se decida una migracion posterior.

## Pruebas futuras en Vercel

Antes de activar cron real:

1. Configurar variables privadas en Vercel.
2. Hacer deploy controlado.
3. Ejecutar endpoint manualmente con token correcto desde una herramienta segura.
4. Revisar logs sin secretos.
5. Revisar que se guardan tasas globales.
6. Revisar que Reportes lee tasas esperadas.
7. Solo despues agregar el cron programado.

## Plan de rollback

Si algo falla en una futura implementacion de Opcion C:

1. Quitar o desactivar el cron en Vercel.
2. Mantener Reportes leyendo `exchange_rates` por usuario.
3. Mantener boton manual de actualizacion.
4. No borrar tasas globales.
5. No borrar tasas por usuario.
6. Revisar logs y corregir en una fase posterior.

## Checklist antes de activar cron

- [ ] Modelo global aprobado.
- [ ] Migracion real revisada.
- [ ] RLS activo en tabla global.
- [ ] Clientes no pueden escribir tasas globales.
- [ ] `CRON_SECRET` configurado solo en servidor.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurado solo en servidor, si se usa.
- [ ] Endpoint falla cerrado sin secreto.
- [ ] Endpoint no consulta Frankfurter sin autenticacion.
- [ ] Mensajes de error no filtran secretos.
- [ ] Build local correcto.
- [ ] Prueba local con token incorrecto.
- [ ] Prueba local con token correcto.
- [ ] Prueba en Vercel sin cron activo.
- [ ] Rollback documentado.

## Lo que no se hizo en esta fase

- No se activo Vercel Cron.
- No se agrego `vercel.json` con cron activo.
- No se agrego `CRON_SECRET`.
- No se agrego `SUPABASE_SERVICE_ROLE_KEY`.
- No se uso `service_role`.
- No se ejecuto SQL.
- No se modifico base de datos.
- No se cambiaron calculos financieros.
- No se modificaron saldos originales.
