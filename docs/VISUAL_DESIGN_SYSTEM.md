# Sistema visual de Patrimonio Personal

Este documento define la base visual de la app antes de redisenar pantallas especificas. La intencion es mantener una experiencia financiera seria, clara y confiable, sin hacerla fria ni complicada.

## Direccion visual general

Patrimonio Personal debe sentirse como una app financiera personal premium:

- Sobria y moderna.
- Limpia en movil y escritorio.
- Orientada a numeros, tarjetas y jerarquia clara.
- Con fondos neutros y superficies blancas.
- Con acentos discretos en verde, azul y dorado.
- Sin exceso de color, brillos o estilo de casino crypto.

La interfaz debe ayudar a responder rapido:

- Cuanto tengo.
- Cuanto debo.
- Que cambio.
- Que requiere atencion.

## Paleta recomendada

### Fondo

- Principal: `slate-50` / `#f8fafc`
- Fondo suave alterno: `#f1f5f9`
- Se permite un gradiente muy sutil para dar profundidad, nunca decorativo en exceso.

### Superficie y tarjetas

- Tarjeta principal: `white`
- Tarjeta secundaria: `slate-50`
- Borde: `slate-200`
- Sombra: `shadow-sm`

### Texto

- Texto principal: `slate-950`
- Texto normal: `slate-800`
- Texto secundario: `slate-600`
- Texto auxiliar: `slate-500`

### Acentos por intencion

- Positivo / progreso: `teal-600` o `emerald-600`
- Informacion: `blue-600`
- Advertencia: `amber-600` / `amber-700`
- Error / destructivo: `red-600` / `red-700`
- Premium discreto: `amber-700` o dorado suave, solo en detalles.

## Uso de colores

- El color no debe ser el unico indicador. Siempre acompanar con texto claro.
- Verde/teal significa progreso, exito o dato positivo.
- Azul significa informacion o dato financiero neutro.
- Ambar significa atencion o cercania a limite.
- Rojo significa error, vencido, borrar o riesgo.
- Evitar fondos saturados para bloques completos. Preferir bordes, chips, barras o lineas laterales.

## Tarjetas

Estilo base:

- `rounded-lg`
- `border border-slate-200`
- `bg-white`
- `shadow-sm`
- Padding: `p-4` en movil, `p-5` o `p-6` en escritorio.

Reglas:

- No anidar tarjetas visualmente pesadas dentro de tarjetas.
- Usar tarjetas para metricas, formularios, tablas y estados vacios.
- Las metricas importantes deben tener numero grande y etiqueta pequena.
- Los bloques secundarios pueden usar `bg-slate-50`.

Clases base preparadas:

- `.pp-card`
- `.pp-card-muted`

## Botones

### Primario

Uso: guardar, crear, actualizar, accion principal.

- Fondo `teal-600`
- Texto blanco
- Hover `teal-700`
- Borde suave o sin borde
- Focus visible claro

Clase base preparada:

- `.pp-button-primary`

### Secundario

Uso: cancelar, editar, acciones neutrales.

- Fondo blanco
- Borde `slate-300`
- Texto `slate-700`
- Hover con acento teal discreto

Clase base preparada:

- `.pp-button-secondary`

### Destructivo

Uso: borrar o acciones irreversibles.

- Texto `red-700`
- Borde o fondo `red-50`
- Siempre pedir confirmacion cuando borre datos.

## Inputs y selects

Estilo base:

- `rounded-md`
- `border border-slate-300`
- `bg-white`
- Texto claro y legible
- Focus con `teal-500` y anillo suave

Clase base preparada:

- `.pp-input`

Reglas:

- Labels claros.
- Placeholder util, no como sustituto del label.
- En movil, inputs y botones deben ocupar ancho completo cuando ayude.
- Mensajes de error debajo o encima del formulario, sin lenguaje tecnico.

## Tablas

Estilo:

- Encabezados en `slate-500`.
- Filas con divisores `slate-100`.
- Montos alineados a la derecha cuando sea tabla financiera.
- En movil, tabla dentro de `overflow-x-auto`.
- La pagina completa no debe generar scroll horizontal.

Reglas:

- Las tablas son buenas para historial y movimientos.
- Las tarjetas son mejores para resumen y acciones principales.
- Si una tabla es ancha, debe tener scroll interno.

## Navegacion

La navegacion principal usa pills compactas:

- Activa: fondo teal, texto blanco.
- Inactiva: fondo blanco, borde slate, hover teal.
- En movil: scroll horizontal interno.
- En escritorio: puede envolver en varias lineas.

La marca debe mantenerse simple:

- Nombre: `Patrimonio Personal`.
- Subtitulo discreto: `Finanzas personales`.

## Metricas financieras

Reglas:

- Numeros importantes grandes y con buen contraste.
- Siempre mostrar moneda.
- No mezclar monedas distintas en una sola cifra.
- Usar separadores de miles y decimales consistentes.
- Evitar bloques con demasiados numeros del mismo peso visual.

Jerarquia recomendada:

1. Total principal o patrimonio.
2. Desglose por moneda.
3. Indicadores de deuda, disponible o avance.
4. Listas recientes y detalles.

## Estados vacios

Un estado vacio debe:

- Explicar que falta.
- Indicar el siguiente paso.
- No sonar tecnico.
- Usar tarjeta simple con borde suave.

Ejemplo:

> Todavia no tienes cuentas. Crea una cuenta para empezar a calcular tu patrimonio.

## Mensajes de exito y error

- Exito: borde/fondo verde o teal suave.
- Error: rojo suave, mensaje claro y accion sugerida.
- Informacion: azul o slate.
- Advertencia: ambar.

Evitar mensajes como "error 23505" para usuarios finales. Si se necesita el detalle tecnico, dejarlo en consola o documentacion, no como mensaje principal.

## Reglas para movil

- Usar `grid-cols-1` por defecto.
- Usar `md:grid-cols-2` o `lg:grid-cols-3` solo en pantallas mayores.
- Usar `min-w-0` en grids y flex containers.
- Usar `max-w-full` en tarjetas, tablas, formularios y badges.
- Tablas anchas deben tener scroll interno.
- Botones principales pueden ocupar ancho completo.
- Evitar filas de botones apretadas; usar `flex-col sm:flex-row`.

## Modo claro/oscuro

Actualmente la app usa modo claro.

La direccion visual permite acentos oscuros tipo slate, pero no se debe activar modo oscuro completo hasta disenar y probar:

- Contraste de tablas.
- Estados de error/exito.
- Inputs.
- Graficas/barras.
- Legibilidad en movil.

Por ahora:

- Mantener `color-scheme: light`.
- Usar fondos slate claros.
- Usar textos oscuros.
- Usar acentos sobrios.

## Reglas para futuras pantallas

- No introducir paletas nuevas por modulo.
- Reutilizar tokens de color e intencion.
- Mantener tarjetas limpias y no saturar el Dashboard.
- Priorizar legibilidad de numeros sobre decoracion.
- Toda nueva tabla debe probarse en movil.
- Toda accion destructiva debe distinguirse visualmente.
