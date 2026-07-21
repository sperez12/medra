# Prueba de aislamiento entre dos usuarios

Fase: v0.10.4-two-user-isolation-test  
Base: v0.10.3-exchange-rate-lazy-refresh  
Estado: guia manual. No ejecuta SQL y no modifica base de datos por si misma.

## 1. Resumen ejecutivo

Esta prueba verifica que dos usuarios distintos de Medra no puedan ver, editar ni borrar datos entre si.

Es importante porque Medra maneja informacion financiera personal: tarjetas, gastos, cuentas, inversiones, presupuestos, metas, preferencias, alertas y reportes patrimoniales. El riesgo que buscamos cubrir es una fuga de datos entre cuentas de usuario por una consulta mal filtrada, una politica RLS faltante o una accion que use solo `id` sin confirmar `user_id`.

La prueba pasa si:

- Usuario A solo ve datos de Usuario A.
- Usuario B solo ve datos de Usuario B.
- Los totales, reportes, alertas y preferencias no mezclan datos.
- Las APIs que modifican o consultan proveedores externos exigen sesion cuando corresponde.
- Supabase tiene RLS activo y politicas por usuario en las tablas privadas.

## 2. Usuarios de prueba

Prepara dos usuarios:

- Usuario A: tu usuario principal actual.
- Usuario B: usuario secundario de prueba.

Recomendaciones:

- Usa otro correo real o un alias de prueba si tu proveedor de correo lo permite.
- No uses datos financieros reales sensibles para Usuario B.
- Si pruebas en produccion, crea datos pequenos y claramente marcados como prueba.
- Haz la prueba en ventanas separadas: por ejemplo, Usuario A en navegador normal y Usuario B en ventana privada/incognito.

## 3. Datos de prueba recomendados

Usa nombres muy obvios para distinguir usuarios. Ejemplo:

- Usuario A usa prefijo `A_TEST_`.
- Usuario B usa prefijo `B_TEST_`.

### Usuario A

Crea datos propios con nombres como:

- Tarjeta: `A_TEST_TARJETA`
- Gasto: descripcion `A_TEST_GASTO_GASOLINA`
- Pago: descripcion `A_TEST_PAGO_TARJETA`
- Cuenta: `A_TEST_CUENTA`
- Movimiento de cuenta: descripcion `A_TEST_MOVIMIENTO`
- Transferencia, si aplica: descripcion `A_TEST_TRANSFERENCIA`
- Presupuesto: `A_TEST_PRESUPUESTO`
- Meta: `A_TEST_META`
- Aportacion a meta: descripcion `A_TEST_APORTACION`
- Plataforma de inversion: `A_TEST_PLATAFORMA`
- Activo: simbolo `ATEST`, nombre `A_TEST_ACTIVO`
- Holding: notas `A_TEST_HOLDING`
- Transaccion: descripcion `A_TEST_TRANSACCION`
- Snapshot: notas `A_TEST_SNAPSHOT`
- Preferencias: display name `A_TEST_USUARIO`
- Preferencias de alertas: cambia temporalmente un valor reconocible, por ejemplo dias de aviso de tarjeta.
- Tipos de cambio automaticos: actualiza tasas con moneda base `MXN` o la moneda preferida de Usuario A.

### Usuario B

Crea datos equivalentes con prefijo `B_TEST_`:

- Tarjeta: `B_TEST_TARJETA`
- Gasto: descripcion `B_TEST_GASTO_COMIDA`
- Pago: descripcion `B_TEST_PAGO_TARJETA`
- Cuenta: `B_TEST_CUENTA`
- Movimiento de cuenta: descripcion `B_TEST_MOVIMIENTO`
- Transferencia, si aplica: descripcion `B_TEST_TRANSFERENCIA`
- Presupuesto: `B_TEST_PRESUPUESTO`
- Meta: `B_TEST_META`
- Aportacion a meta: descripcion `B_TEST_APORTACION`
- Plataforma de inversion: `B_TEST_PLATAFORMA`
- Activo: simbolo `BTEST`, nombre `B_TEST_ACTIVO`
- Holding: notas `B_TEST_HOLDING`
- Transaccion: descripcion `B_TEST_TRANSACCION`
- Snapshot: notas `B_TEST_SNAPSHOT`
- Preferencias: display name `B_TEST_USUARIO`
- Preferencias de alertas: usa un valor diferente al de Usuario A.
- Tipos de cambio automaticos: actualiza tasas con moneda base `USD` o una moneda distinta a Usuario A si quieres distinguir visualmente.

## 4. Checklist de aislamiento por pantalla

Marca cada punto durante la prueba.

### Dashboard

- [ ] Usuario A ve solo tarjetas, cuentas, inversiones, presupuestos, metas, alertas y actividad con prefijo `A_TEST_`.
- [ ] Usuario A no ve ningun dato con prefijo `B_TEST_`.
- [ ] Usuario B ve solo datos con prefijo `B_TEST_`.
- [ ] Usuario B no ve ningun dato con prefijo `A_TEST_`.
- [ ] Totales de patrimonio, tarjetas, cuentas e inversiones no mezclan datos.

### Tarjetas

- [ ] Usuario A ve `A_TEST_TARJETA`.
- [ ] Usuario A no ve `B_TEST_TARJETA`.
- [ ] Usuario B ve `B_TEST_TARJETA`.
- [ ] Usuario B no ve `A_TEST_TARJETA`.
- [ ] Editar una tarjeta propia no afecta tarjetas del otro usuario.
- [ ] Borrar una tarjeta propia no borra tarjetas del otro usuario.

### Gastos

- [ ] Usuario A ve gastos con descripcion `A_TEST_`.
- [ ] Usuario A no ve gastos `B_TEST_`.
- [ ] Usuario B ve gastos con descripcion `B_TEST_`.
- [ ] Usuario B no ve gastos `A_TEST_`.
- [ ] Los filtros de periodo solo muestran gastos propios.
- [ ] Crear, editar y borrar gastos propios no afecta al otro usuario.

### Pagos

- [ ] Usuario A ve pagos `A_TEST_`.
- [ ] Usuario A no ve pagos `B_TEST_`.
- [ ] Usuario B ve pagos `B_TEST_`.
- [ ] Usuario B no ve pagos `A_TEST_`.
- [ ] Si el pago genera movimiento de cuenta, ese movimiento aparece solo para el mismo usuario.
- [ ] Editar o borrar pagos propios no afecta al otro usuario.

### Cuentas

- [ ] Usuario A ve `A_TEST_CUENTA`.
- [ ] Usuario A no ve `B_TEST_CUENTA`.
- [ ] Usuario B ve `B_TEST_CUENTA`.
- [ ] Usuario B no ve `A_TEST_CUENTA`.
- [ ] Movimientos y transferencias muestran solo datos propios.
- [ ] Saldos estimados no mezclan movimientos del otro usuario.

### Presupuestos

- [ ] Usuario A ve `A_TEST_PRESUPUESTO`.
- [ ] Usuario A no ve `B_TEST_PRESUPUESTO`.
- [ ] Usuario B ve `B_TEST_PRESUPUESTO`.
- [ ] Usuario B no ve `A_TEST_PRESUPUESTO`.
- [ ] El gasto real del presupuesto usa solo gastos propios.
- [ ] Editar o borrar presupuestos propios no afecta al otro usuario.

### Metas

- [ ] Usuario A ve `A_TEST_META`.
- [ ] Usuario A no ve `B_TEST_META`.
- [ ] Usuario B ve `B_TEST_META`.
- [ ] Usuario B no ve `A_TEST_META`.
- [ ] Aportaciones a metas se calculan solo con datos propios.
- [ ] Movimientos de cuenta generados por aportaciones aparecen solo en la cuenta del mismo usuario.

### Inversiones

- [ ] Usuario A ve `A_TEST_PLATAFORMA`, `ATEST` y holdings/transacciones propias.
- [ ] Usuario A no ve `B_TEST_PLATAFORMA`, `BTEST` ni transacciones del otro usuario.
- [ ] Usuario B ve `B_TEST_PLATAFORMA`, `BTEST` y holdings/transacciones propias.
- [ ] Usuario B no ve `A_TEST_PLATAFORMA`, `ATEST` ni transacciones del otro usuario.
- [ ] Actualizar precios solo modifica activos automaticos del usuario autenticado.
- [ ] Holdings duplicados o activos duplicados siguen bloqueados por usuario, no globalmente entre usuarios.

### Reportes

- [ ] Usuario A ve reportes basados solo en `A_TEST_`.
- [ ] Usuario A no ve datos `B_TEST_` en gastos, pagos, patrimonio, snapshots ni tipos de cambio.
- [ ] Usuario B ve reportes basados solo en `B_TEST_`.
- [ ] Usuario B no ve datos `A_TEST_`.
- [ ] Patrimonio consolidado usa solo saldos, inversiones, deudas, snapshots y tipos de cambio del usuario autenticado.
- [ ] Tipos de cambio automaticos guardados por Usuario A no aparecen en Usuario B.

### Alertas

- [ ] Usuario A ve alertas generadas solo por datos `A_TEST_`.
- [ ] Usuario A no ve alertas de Usuario B.
- [ ] Usuario B ve alertas generadas solo por datos `B_TEST_`.
- [ ] Usuario B no ve alertas de Usuario A.
- [ ] Preferencias de alertas de Usuario A no afectan a Usuario B.

### Configuracion

- [ ] Usuario A ve su correo y preferencias propias.
- [ ] Usuario A ve display name `A_TEST_USUARIO` si lo guardo.
- [ ] Usuario A no ve preferencias de Usuario B.
- [ ] Usuario B ve su correo y preferencias propias.
- [ ] Usuario B ve display name `B_TEST_USUARIO` si lo guardo.
- [ ] Usuario B no ve preferencias de Usuario A.

## 5. Pruebas de acciones

Para cada usuario:

1. Inicia sesion.
2. Crea un dato propio con prefijo `A_TEST_` o `B_TEST_`.
3. Edita ese dato propio.
4. Borra ese dato propio si es seguro hacerlo.
5. Confirma que no aparecen datos del otro usuario.
6. Confirma que Dashboard y Reportes recalculan solo con datos propios.

Acciones minimas recomendadas:

- Crear, editar y borrar una tarjeta de prueba.
- Crear, editar y borrar un gasto de prueba.
- Crear, editar y borrar un pago de prueba.
- Crear, editar y borrar una cuenta de prueba.
- Crear, editar y borrar un presupuesto de prueba.
- Crear, editar y borrar una meta de prueba.
- Crear, editar y borrar una plataforma/activo/holding de prueba.
- Guardar y borrar un snapshot de prueba.
- Guardar preferencias de usuario.
- Guardar preferencias de alertas.
- Actualizar tipos de cambio automaticos.

Si estas en produccion, usa montos pequenos y datos claramente marcados como prueba.

## 6. Pruebas de URLs directas

Actualmente Medra usa rutas por seccion, no rutas publicas con IDs visibles como `/tarjetas/[id]` o `/gastos/[id]`.

Checklist:

- [ ] Confirmar que las rutas principales no exponen IDs de datos en la URL.
- [ ] Abrir `/tarjetas` como Usuario A y confirmar que no aparece `B_TEST_TARJETA`.
- [ ] Abrir `/tarjetas` como Usuario B y confirmar que no aparece `A_TEST_TARJETA`.
- [ ] Repetir con `/gastos`, `/pagos`, `/cuentas`, `/inversiones`, `/presupuestos`, `/metas`, `/reportes`, `/alertas` y `/configuracion`.

Si en una fase futura se agregan rutas con IDs:

- Copia una URL de detalle de Usuario A.
- Cierra sesion.
- Inicia sesion como Usuario B.
- Abre la URL copiada.
- Resultado esperado: no debe mostrar datos ajenos; debe redirigir, mostrar vacio o fallar de forma segura.

## 7. Pruebas de APIs

No hagas ataques reales contra produccion. Estas pruebas son manuales y controladas.

Rutas actuales:

- `/api/prices/update`
- `/api/prices/validate`
- `/api/exchange-rates/update`
- `/api/crypto-prices`

Estado esperado:

- Sin sesion o sin `Authorization`, las rutas que actualizan o validan deben responder `401` cuando aplique.
- Con sesion valida, deben operar solo datos del usuario autenticado.
- No deben consultar CoinGecko, Alpha Vantage ni Frankfurter antes de validar sesion.
- No deben exponer claves privadas.
- `/api/crypto-prices` reexporta la ruta de actualizacion de precios, por lo que debe comportarse como `/api/prices/update`.

Pruebas seguras:

- [ ] En navegador sin sesion, intentar usar funciones que llamen precios o tipos de cambio desde la UI debe pedir iniciar sesion o fallar de forma amigable.
- [ ] Con Usuario A, actualizar precios de inversiones y confirmar que solo cambian activos de Usuario A.
- [ ] Con Usuario B, actualizar precios de inversiones y confirmar que solo cambian activos de Usuario B.
- [ ] Con Usuario A, actualizar tipos de cambio y confirmar que solo aparecen en Reportes de Usuario A.
- [ ] Con Usuario B, actualizar tipos de cambio y confirmar que solo aparecen en Reportes de Usuario B.

## 8. RLS en Supabase

No cambies politicas durante esta prueba. Solo revisa.

En Supabase Dashboard:

1. Abre tu proyecto.
2. Ve a Table Editor o Authentication/Policies segun la pantalla disponible.
3. Revisa que RLS este activo en tablas privadas de usuario.
4. Revisa que las politicas limiten operaciones al usuario autenticado.

Tablas principales a revisar:

- `profiles`
- `categories`
- `credit_cards`
- `expenses`
- `payments`
- `accounts`
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
- `net_worth_snapshots`
- `manual_exchange_rates`
- `user_preferences`
- `user_alert_preferences`
- `exchange_rates`
- `financial_events`, si existe en produccion

Patron esperado:

- Tablas con `user_id`: politicas basadas en `auth.uid() = user_id`.
- `profiles`: politicas basadas en `auth.uid() = id`.
- `exchange_rates`: politicas por `auth.uid() = user_id`.
- `user_preferences`: una fila por usuario y politicas por `auth.uid() = user_id`.
- `user_alert_preferences`: una fila por usuario y politicas por `auth.uid() = user_id`.

Si una tabla privada no tiene RLS activo, la prueba falla.

## 9. Criterios de exito

La prueba pasa si:

- Usuario A nunca ve datos de Usuario B.
- Usuario B nunca ve datos de Usuario A.
- Usuario A no puede editar ni borrar datos de Usuario B.
- Usuario B no puede editar ni borrar datos de Usuario A.
- Dashboard no mezcla totales.
- Reportes no mezclan gastos, pagos, patrimonio, snapshots ni tasas.
- Alertas son independientes.
- Preferencias de usuario son independientes.
- Preferencias de alertas son independientes.
- Tipos de cambio automaticos guardados por usuario no se mezclan.
- Las APIs requieren sesion donde corresponde.
- Las rutas de proveedores no consultan proveedores externos antes de validar sesion.

## 10. Que hacer si falla

Si ves datos cruzados o una accion afecta al otro usuario:

1. No sigas agregando funcionalidades.
2. No invites beta testers.
3. Toma nota de:
   - usuario usado;
   - pantalla o ruta;
   - dato filtrado;
   - accion realizada;
   - resultado esperado;
   - resultado real.
4. Identifica la tabla probable.
5. Revisa si la query filtra por `user_id`.
6. Revisa si RLS esta activo.
7. Revisa si la politica usa `auth.uid() = user_id` o `auth.uid() = id` para `profiles`.
8. Crea una fase de correccion especifica y pequena.
9. Vuelve a correr esta prueba despues de corregir.

## 11. Puntos de riesgo a vigilar

No detecte un riesgo serio que obligue a detener esta fase.

Puntos que conviene vigilar durante la prueba:

- Las paginas estan protegidas principalmente en cliente; la defensa fuerte debe ser RLS mas filtros `user_id`.
- Las acciones de borrado deben seguir usando RLS como defensa principal y, cuando sea posible, filtro adicional por `user_id`.
- Los tipos de cambio automaticos actuales estan por usuario en `exchange_rates`; no deben aparecer entre usuarios.
- El archivo `docs/DRAFT_GLOBAL_EXCHANGE_RATES.sql` es solo borrador y no debe ejecutarse.
- Si una tabla nueva se agrega en el futuro, debe entrar a esta prueba.

## 12. Registro de resultados

Usa esta tabla al terminar:

| Area | Usuario A OK | Usuario B OK | Notas |
| --- | --- | --- | --- |
| Dashboard | [ ] | [ ] | |
| Tarjetas | [ ] | [ ] | |
| Gastos | [ ] | [ ] | |
| Pagos | [ ] | [ ] | |
| Cuentas | [ ] | [ ] | |
| Presupuestos | [ ] | [ ] | |
| Metas | [ ] | [ ] | |
| Inversiones | [ ] | [ ] | |
| Reportes | [ ] | [ ] | |
| Alertas | [ ] | [ ] | |
| Configuracion | [ ] | [ ] | |
| APIs | [ ] | [ ] | |
| RLS Supabase | [ ] | [ ] | |

Resultado final:

- [ ] Prueba aprobada.
- [ ] Prueba no aprobada.
- [ ] Se requiere fase de correccion.
