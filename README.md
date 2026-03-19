# Pedidos Materia Prima

Aplicacion web interna para gestionar pedidos de materia prima, inventario operativo, cobertura de materiales, consumos manuales y prestamos o devoluciones de canastillas sobre Supabase.

## Que resuelve

- Dashboard consolidado de pedidos pendientes y materiales con cobertura critica.
- CRUD de materiales por planta o zona.
- Flujo completo de pedidos: creacion, edicion, recepcion, completado y reversa.
- Gestion operativa de inventario con ajustes manuales, consumos, fotos y snapshots.
- Historial filtrable de pedidos completados o cancelados.
- Registro de canastillas con firma digital y gestion de proveedores.
- Tareas programadas para snapshots y alertas criticas por correo.

## Stack principal

- `Next.js 15` con `App Router`
- `React 19` + `TypeScript`
- `Supabase` como base de datos, auth, storage y RPC
- `Tailwind CSS 4`, `Radix UI` y componentes estilo `shadcn/ui`
- `zod` para validaciones de payload en rutas API
- `pdfkit`, `jsPDF` y utilidades HTML a imagen para exportes
- `Resend` para correos de alerta critica

## Inicio rapido

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Configura variables de entorno:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   RESEND_API_KEY=
   ALERTA_CRITICA_FROM=
   ```

3. Levanta el entorno local:

   ```bash
   npm run dev
   ```

4. Abre `http://localhost:3000`.

## Scripts

| Script | Descripcion |
| --- | --- |
| `npm run dev` | Desarrollo con Turbopack. |
| `npm run build` | Build de produccion. |
| `npm run start` | Ejecuta la app construida. |
| `npm run lint` | Ejecuta ESLint. |

## Documentacion

- Tecnica detallada: `docs/documentacion-tecnica.md`

## Notas operativas importantes

- El build ignora errores de TypeScript y lint en `next.config.ts`.
- La ruta `/Pconsumo` existe, pero `middleware.ts` la bloquea con `403`.
- `vercel.json` programa un cron en `/api/consumo/cron`, pero ese endpoint no existe en este repositorio.
- `app/layout.tsx` redirige a `/auth/login` al cerrar sesion, pero no hay ruta `app/auth/login`.
- No hay pruebas automatizadas en el repositorio actual.
