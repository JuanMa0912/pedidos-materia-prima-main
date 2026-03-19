# Operacion y Despliegue

## Requisitos

- `Node.js` 20 o superior recomendado.
- Proyecto Supabase existente y configurado.
- Credenciales de `anon key` y `service role key`.
- Cuenta de Resend solo si se usaran alertas criticas por correo.

## Setup local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Definir variables de entorno en un archivo local no versionado.

3. Ejecutar:

   ```bash
   npm run dev
   ```

4. Validar manualmente:
   - `/`
   - `/pedidos`
   - `/inventario`
   - `/canastillas`

## Variables de entorno

| Variable | Requerida | Consumida por | Observaciones |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Si | `lib/supabase.ts`, `lib/supabasedamin.ts`, alertas criticas | Sin esta variable la app falla al importar cliente Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Si | cliente navegador, exporte PDF, fallback en alerta criticos | Se expone al cliente por diseño. |
| `SUPABASE_SERVICE_ROLE_KEY` | Si para backend real | casi todas las rutas `app/api/**` | Necesaria para storage, auth admin y cron. |
| `RESEND_API_KEY` | Solo correo | `/api/inventario/alerta-criticos/cron` | Si falta, el cron de correos falla. |
| `ALERTA_CRITICA_FROM` | Solo correo | `/api/inventario/alerta-criticos/cron` | Remitente de Resend. |

## Comandos y configuracion de build

| Archivo / comando | Papel |
| --- | --- |
| `npm run dev` | Desarrollo con Turbopack. |
| `npm run build` | Build con Turbopack. |
| `npm run start` | Runtime Node de Next.js. |
| `npm run lint` | Unica validacion automatizada definida en scripts. |
| `next.config.ts` | Ignora errores de ESLint y TypeScript en build. |
| `postcss.config.mjs` | Integra `@tailwindcss/postcss`. |
| `components.json` | Configuracion de componentes estilo shadcn. |

## Opciones de despliegue presentes en el repo

### Vercel

`vercel.json` define:

- `buildCommand: next build --no-lint`
- cron jobs diarios

Se asume despliegue serverless o edge-friendly para los route handlers, excepto el exporte PDF que fuerza `runtime = "nodejs"`.

### PM2 / servidor propio

`ecosystem.config.js` define una app:

- nombre: `pedidos`
- comando: `npm run start`
- cwd: `/home/pedidos/pedidos_app`
- puerto: `3000`
- reinicio por memoria: `400M`

Esto sugiere una segunda via de despliegue fuera de Vercel.

## Cron jobs y operacion programada

| Job | Objetivo | Dependencias | Estado |
| --- | --- | --- | --- |
| `/api/inventario/inventario-snapshots/cron` | Persistir snapshot diario por zona objetivo. | RPC `inventario_actual`, tabla `inventario_snapshots` | Implementado. |
| `/api/inventario/alerta-criticos/cron` | Enviar correo de materiales criticos sin pedido. | RPC `inventario_actual`, tabla `alertas_criticos_envios`, Resend | Implementado. |
| `/api/consumo/cron` | No se puede documentar funcionalmente. | Ruta no existe | Inconsistente en `vercel.json`. |

## Operacion diaria recomendada

### Pedidos

- Crear pedidos desde `/pedidos/nuevo`.
- Revisar pedidos por zona en `/pedidos`.
- Completar pedidos solo despues de validar recepcion fisica.
- Si se completo por error, usar la reversa desde pedidos o inventario.

### Inventario

- Ajustar stock solo cuando se necesite corregir el valor absoluto.
- Registrar consumos manuales con notas claras.
- Adjuntar fotos cuando el consumo requiera evidencia.
- Consultar materiales criticos desde el modal de alertas o el dashboard.

### Canastillas

- Mantener actualizado el catalogo de proveedores.
- Usar anulacion en vez de borrar historicos operativos.
- Verificar que las firmas puedan resolverse via signed URL.

## Checklist de validacion despues de desplegar

- `GET /api/inventario` responde sin error.
- La creacion de pedidos persiste `pedidos` y `pedido_items`.
- Completar un pedido inserta movimientos de inventario.
- Las fotos de consumo llegan al bucket `consumos`.
- Las firmas de canastillas llegan al bucket `canastillas-firmas`.
- El cron de snapshots inserta o actualiza filas en `inventario_snapshots`.
- El cron de alertas puede leer zonas activas y enviar correo.

## Riesgos y gaps tecnicos abiertos

- No hay pruebas automatizadas.
- `next.config.ts` permite builds con errores de tipado o lint.
- `middleware.ts` bloquea `/Pconsumo`, aunque el modulo sigue en codigo.
- `vercel.json` referencia `/api/consumo/cron`, ruta inexistente.
- `app/layout.tsx` redirige a `/auth/login`, ruta inexistente.
- No hay guardas explicitas de autorizacion para `/admin/users` ni para las APIs admin.
- Los umbrales de cobertura no estan centralizados.
- Existen archivos legacy sin referencias activas.
- `lib/reservas/route.ts` no esta publicado como API aunque parece preparado para ello.

## Recomendaciones de mantenimiento

1. Versionar migraciones SQL, RPC y buckets requeridos.
2. Centralizar reglas de cobertura en un solo modulo compartido.
3. Definir una estrategia unica de autenticacion y autorizacion.
4. Corregir el cron faltante o eliminarlo de `vercel.json`.
5. Eliminar o mover artefactos legacy para reducir ambiguedad.
6. Habilitar al menos una validacion minima en CI: `npm run lint` y `tsc --noEmit`.
