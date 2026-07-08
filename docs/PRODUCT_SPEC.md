# Patrimonio Personal - Product Spec

## Problema que resuelve

Muchas personas tienen sus finanzas repartidas entre tarjetas de credito, cuentas bancarias, efectivo, inversiones, cripto, hojas de calculo y apps separadas. Esto hace dificil saber cuanto se debe, cuanto se tiene, que pagos vienen, cuanto se gasto en el periodo actual y como evoluciona el patrimonio neto.

Patrimonio Personal busca centralizar esa informacion en una app web privada, ordenada y facil de consultar.

## Publico objetivo

- Personas que usan una o varias tarjetas de credito.
- Personas que quieren controlar gastos por periodo de corte.
- Personas con cuentas bancarias, efectivo e inversiones en distintas plataformas.
- Personas sin experiencia tecnica que quieren una herramienta clara y guiada.

## Modulos principales

- Dashboard: resumen general de deuda, gasto, patrimonio y eventos proximos.
- Tarjetas: alta, edicion, baja y seguimiento de tarjetas de credito.
- Gastos: registro manual de gastos, categorias, recurrencias y meses sin intereses.
- Pagos: pagos a tarjetas, cuentas y obligaciones.
- Cuentas: bancos, efectivo y movimientos.
- Inversiones: plataformas, activos, holdings, compras y ventas.
- Cripto: activos cripto, operaciones y valor de mercado.
- Presupuestos: limites por categoria y mes.
- Metas: ahorro, deuda, inversion y objetivos personales.
- Calendario: cortes, fechas limite, pagos recurrentes y recordatorios.
- Reportes: analisis de gastos, tendencias y patrimonio neto.
- Configuracion: perfil, categorias, monedas y preferencias.

## Pantallas principales

- Inicio / Dashboard
- Login
- Tarjetas
- Gastos
- Pagos
- Cuentas
- Inversiones
- Cripto
- Presupuestos
- Metas
- Calendario
- Reportes
- Configuracion

## Funcionalidades actuales

- Estructura inicial con Next.js, TypeScript y Tailwind CSS.
- Navegacion base.
- Login por correo con Supabase Auth.
- Crear, listar, editar y borrar tarjetas.
- Registrar gastos manualmente.
- Ver gasto por tarjeta dentro del periodo actual.
- Calcular periodo actual segun dia de corte.
- Documentacion inicial y SQL para Supabase.

## Funcionalidades futuras

- Dashboard con metricas reales.
- Pagos a tarjetas y calculo de deuda.
- Meses sin intereses con parcialidades generadas automaticamente.
- Cuentas bancarias y movimientos.
- Inversiones multi-plataforma.
- Precios historicos de activos.
- Patrimonio neto.
- Presupuestos mensuales.
- Metas con avance.
- Calendario financiero con alertas.
- Reportes exportables.
- Deploy en Vercel.

## Flujo general de usuario

1. El usuario entra a la app.
2. Inicia sesion con su correo.
3. Registra sus tarjetas de credito.
4. Captura gastos manualmente.
5. Consulta cuanto lleva gastado por tarjeta en el periodo actual.
6. Mas adelante, registra pagos, cuentas, inversiones y metas.
7. El dashboard resume el estado financiero general.
