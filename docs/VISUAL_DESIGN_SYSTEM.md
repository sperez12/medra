# Sistema visual de Medra para Patrimonio Personal

Este documento define la identidad visual que se aplicara a la app. La referencia principal es la marca visible **Medra**, pero el nombre tecnico del proyecto se mantiene como **Patrimonio Personal**.

La app debe sentirse premium, limpia, confiable y financiera, con una estetica calmada. La direccion toma inspiracion de la referencia de Medra sin copiarla literalmente.

## Capas de marca

- Simbolo grafico / monograma: una `M` abstracta construida con SVG simple en codigo.
- Nombre visible: `Medra`.
- Eslogan: `Tu patrimonio, en crecimiento.`
- Nombre tecnico del proyecto: `Patrimonio Personal`.
- Dominio y URLs: neutrales durante desarrollo.

El usuario final puede ver `Medra` como marca de producto. El codigo, repositorio, variables y documentacion tecnica pueden seguir usando `Patrimonio Personal` cuando sea necesario.

## Direccion visual general

- Premium, sobria y confiable.
- Fondo claro tipo marfil.
- Superficies blancas.
- Bordes suaves.
- Sombras sutiles.
- Acento verde petroleo.
- Menta y verde medio como apoyo.
- Beige calido como acento complementario.
- Numeros grandes y legibles.
- Navegacion clara en movil y escritorio.
- Evitar estilo recargado, infantil o "crypto casino".

## Paleta base

- Primario oscuro: `#0D1B2A`
- Verde petroleo: `#1F7A6E`
- Menta: `#A7D5C9`
- Marfil calido: `#F2EDE3`
- Neutro claro: `#F5F6F7`
- Neutro oscuro: `#68717A`

## Uso de colores por intencion

### Fondo

- Base: `#F2EDE3`
- Fondo claro de app: `#F5F6F7`
- Gradientes sutiles con menta y marfil, nunca saturados.

### Superficie / tarjetas

- Principal: blanco.
- Secundaria: `#F5F6F7`.
- Profunda / hero: `#0D1B2A`.
- Borde suave: beige grisaceo o slate muy claro.

### Texto

- Principal: `#0D1B2A`.
- Secundario: `#68717A`.
- Sobre fondos oscuros: blanco con opacidad controlada.

### Acento positivo

- `#1F7A6E`.
- Usar para progreso, acciones principales y estados positivos.

### Advertencia

- Ambar/dorado suave.
- Usar para proximidad a limites o atencion.

### Error

- Rojo suave para fondos.
- Rojo mas fuerte para texto destructivo.

### Informacion

- Azul sobrio o verde petroleo cuando sea informacion financiera neutra.

## Tipografia

### Titulos

Preferencia: `DM Serif Display`.

Como no se instalan dependencias ni se carga una fuente externa en esta fase, el fallback configurado es:

```text
DM Serif Display, Georgia, Cambria, Times New Roman, serif
```

Uso:

- Marca visible `Medra`.
- Titulos principales.
- Secciones de alto nivel como patrimonio y dashboard.

### Texto y UI

Preferencia: `Inter`.

Fallback configurado:

```text
Inter, Arial, Helvetica, sans-serif
```

Uso:

- Formularios.
- Tablas.
- Navegacion.
- Labels.
- Numeros y texto cotidiano.

## Monograma

El monograma debe:

- Sugerir una `M` abstracta.
- Combinar azul profundo, verde petroleo y menta.
- Usar formas suaves y superpuestas.
- Funcionar en header, login, Dashboard y favicon futuro.
- Estar hecho con SVG/CSS simple, sin imagen externa.

Implementacion actual:

- `src/components/brand/brand-mark.tsx`

Configuracion de marca:

- `src/lib/brand.ts`

## Tarjetas

Estilo base:

- Radio amplio pero sobrio: `rounded-2xl`.
- Fondo blanco.
- Borde suave.
- Sombra ligera.
- Padding generoso.

Clases base:

- `.pp-card`
- `.pp-card-muted`
- `.pp-card-deep`
- `.pp-metric-card`

Reglas:

- Las tarjetas de resumen deben respirar.
- Las metricas principales deben tener numeros grandes.
- No saturar con muchos colores al mismo nivel.
- En movil, una tarjeta por fila si el contenido es denso.

## Botones

### Primario

- Verde petroleo.
- Texto blanco.
- Forma tipo pill.
- Peso semibold.

Clase:

- `.pp-button-primary`

### Secundario

- Fondo blanco.
- Borde verde suave.
- Texto verde/oscuro.

Clase:

- `.pp-button-secondary`

### Destructivo

- Mantener rojo.
- Debe verse diferente de acciones neutrales.
- Siempre con confirmacion para borrado.

## Inputs y selects

Clase base:

- `.pp-input`

Estilo:

- Radio suave.
- Borde claro.
- Focus verde petroleo.
- Sombra sutil.

Reglas:

- Labels claros.
- Placeholders utiles.
- En movil, ancho completo.
- Mensajes de error humanos, no tecnicos.

## Badges y chips

Clase base:

- `.pp-badge`

Uso:

- Moneda.
- Estado.
- Fuente de precio.
- Urgencia.

No usar badges con colores demasiado fuertes salvo errores o advertencias.

## Tablas

- Mantener tablas limpias.
- Encabezados en texto secundario.
- Filas con divisores suaves.
- Montos alineados a la derecha.
- Scroll horizontal interno en movil.
- La pagina completa nunca debe generar scroll horizontal.

## Navegacion

La navegacion principal usa pills:

- Activa: verde petroleo, texto blanco.
- Inactiva: blanco translucid, borde suave.
- Movil: scroll horizontal interno.
- Escritorio: puede envolver.

Header:

- Monograma.
- Marca visible `Medra`.
- Eslogan.
- Nombre tecnico solo como referencia accesible/documental.

## Metricas financieras

Reglas:

- Numeros grandes y claros.
- Siempre mostrar moneda.
- No mezclar monedas.
- Usar tarjetas profundas solo para informacion protagonista.
- Usar barras sutiles para comparacion, no graficas recargadas.

## Dashboard

El Dashboard es la primera pantalla redisenada con la identidad Medra.

Debe tener:

- Hero oscuro premium.
- Monograma visible.
- Titulo editorial con tipografia serif.
- Senales clave compactas.
- Patrimonio neto como bloque protagonista.
- Tarjetas limpias y espaciadas.
- Actividad reciente sin perder legibilidad.

## Movil

- Mantener `min-w-0` en grids/flex.
- Evitar anchos fijos.
- Tablas con `overflow-x-auto`.
- Botones pueden ocupar ancho completo cuando ayude.
- Hero debe apilar contenido.
- Monograma y textos deben poder reducirse sin desbordar.

## Modo claro/oscuro

Actualmente la app sigue en modo claro.

Se permite usar bloques oscuros puntuales, como el hero del Dashboard, pero no activar modo oscuro completo hasta probar:

- Tablas.
- Inputs.
- Reportes.
- Estados de error.
- Contraste movil.

## Reglas para futuras fases

- Redisenar una pantalla por fase.
- No tocar calculos financieros al redisenar UI.
- Mantener responsive antes de hacer commit.
- No introducir librerias visuales nuevas sin una razon clara.
- Mantener la separacion entre marca visible y nombre tecnico.
