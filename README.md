# Patrimonio Personal

App web para organizar tarjetas de credito, gastos, pagos, cuentas, inversiones, cripto, presupuestos, metas, calendario financiero y reportes.

## Que incluye esta primera base

- Next.js con TypeScript.
- Tailwind CSS para estilos.
- Supabase preparado para autenticacion y base de datos.
- Navegacion inicial con las secciones principales.
- Documentacion funcional y diseno de base de datos en la carpeta `docs`.
- Primera version del MVP para login, tarjetas y gastos manuales.

## Requisitos

Necesitas instalar:

1. Node.js LTS desde https://nodejs.org
2. Una cuenta gratuita en https://supabase.com

## Como correr el proyecto localmente

Abre una terminal dentro de esta carpeta y ejecuta:

```bash
npm install
npm run dev
```

Luego abre:

```text
http://localhost:3000
```

## Configurar Supabase paso a paso

1. Entra a https://supabase.com y crea una cuenta.
2. Crea un proyecto nuevo.
3. Ve a `Project Settings` y luego a `API`.
4. Copia estos valores:
   - Project URL
   - anon public key
5. Crea un archivo llamado `.env.local` en la raiz del proyecto.
6. Copia el contenido de `.env.example` dentro de `.env.local`.
7. Reemplaza los valores de ejemplo por los valores reales de Supabase.

Ejemplo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
```

Importante: nunca compartas el archivo `.env.local`.

## Crear las tablas en Supabase

1. En Supabase, abre `SQL Editor`.
2. Copia y ejecuta el contenido de `docs/SUPABASE_SCHEMA.sql`.
3. Despues copia y ejecuta el contenido de `docs/SUPABASE_RLS.sql`.

## Estado del proyecto

Esta es una base inicial. Todavia faltan pruebas, detalles visuales avanzados y validaciones profundas, pero ya deja una estructura clara para avanzar por fases.
