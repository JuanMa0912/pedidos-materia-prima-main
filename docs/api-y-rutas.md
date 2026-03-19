# API y Rutas

## Rutas web

| Ruta | Archivo | Proposito | Notas |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | Dashboard operativo. | Resume cobertura y pedidos enviados. |
| `/materiales` | `app/materiales/page.tsx` | CRUD de materiales. | Filtra zonas objetivo. |
| `/pedidos` | `app/pedidos/page.tsx` | Listado de pedidos por planta. | Usa tabs por zona y cache local. |
| `/pedidos/nuevo` | `app/pedidos/nuevo/page.tsx` | Crear pedido. | Llama `POST /api/pedidos`. |
| `/pedidos/[id]` | `app/pedidos/[id]/page.tsx` | Editar pedido. | Permite cambiar items y estado. |
| `/pedidos/[id]/editar` | `app/pedidos/[id]/editar/page.tsx` | Alias de edicion. | Reexporta `/pedidos/[id]`. |
| `/pedidos/[id]/ver` | `app/pedidos/[id]/ver/page.tsx` | Vista de lectura/exporte. | Complementa exporte PDF y PNG. |
| `/inventario` | `app/inventario/page.tsx` | Operacion de inventario. | Modulo mas grande del repo. |
| `/historial` | `app/historial/page.tsx` | Historial de pedidos. | Filtra completados y cancelados. |
| `/canastillas` | `app/canastillas/page.tsx` | Flujo de prestamo/devolucion. | Wizard con firma. |
| `/canastillas/inventario` | `app/canastillas/inventario/page.tsx` | Inventario/historial de canastillas. | Permite editar y anular. |
| `/canastillas/proveedores` | `app/canastillas/proveedores/page.tsx` | CRUD de proveedores. | Usa API dedicada. |
| `/Pconsumo` | `app/Pconsumo/page.tsx` | Consumo manual de salmuera. | `middleware.ts` la bloquea con `403`. |
| `/admin/users` | `app/admin/users/page.tsx` | Admin de usuarios Supabase. | No hay guardas de acceso visibles. |

## Route handlers HTTP

| Metodo | Ruta | Archivo | Usa service role | Proposito | Dependencias |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/pedidos` | `app/api/pedidos/route.ts` | Si | Crear pedido validado. | `zonas`, `materiales`, `pedidos`, `pedido_items` |
| `GET` | `/api/inventario` | `app/api/inventario/route.ts` | Si | Obtener inventario actual por zona o global. | RPC `inventario_actual`, `zonas` |
| `POST` | `/api/consumos/upload` | `app/api/consumos/upload/route.ts` | Si | Subir fotos de consumo. | Bucket `consumos` |
| `GET` | `/api/admin/users` | `app/api/admin/users/route.ts` | Si | Listar usuarios de Supabase Auth. | Auth Admin |
| `POST` | `/api/admin/users` | `app/api/admin/users/route.ts` | Si | Crear usuario. | Auth Admin |
| `PUT` | `/api/admin/users` | `app/api/admin/users/route.ts` | Si | Resetear contrasena. | Auth Admin |
| `POST` | `/api/canastillas` | `app/api/canastillas/route.ts` | Si | Guardar prestamo/devolucion con firma. | Bucket `canastillas-firmas`, tabla `canastillas` |
| `POST` | `/api/canastillas/firma` | `app/api/canastillas/firma/route.ts` | Si | Generar signed URL para firma. | Bucket `canastillas-firmas` |
| `POST` | `/api/canastillas/proveedores` | `app/api/canastillas/proveedores/route.ts` | Si | Crear proveedor. | `canastillas_proveedores` |
| `PUT` | `/api/canastillas/proveedores` | `app/api/canastillas/proveedores/route.ts` | Si | Editar proveedor. | `canastillas_proveedores` |
| `DELETE` | `/api/canastillas/proveedores` | `app/api/canastillas/proveedores/route.ts` | Si | Eliminar o desactivar proveedor. | `canastillas_proveedores` |
| `POST` | `/api/inventario/alerta-criticos/pedidos` | `app/api/inventario/alerta-criticos/pedidos/route.ts` | Preferentemente si | Verificar si materiales criticos ya tienen pedido pendiente. | `pedidos`, `pedido_items` |
| `GET` | `/api/inventario/alerta-criticos/cron` | `app/api/inventario/alerta-criticos/cron/route.ts` | Si | Enviar correo diario de alertas criticas. | RPC `inventario_actual`, `alertas_criticos_envios`, Resend |
| `GET` | `/api/inventario/inventario-snapshots` | `app/api/inventario/inventario-snapshots/route.ts` | Si | Consultar snapshots por zona/material/fecha/mes. | `inventario_snapshots` |
| `GET` | `/api/inventario/inventario-snapshots/cron` | `app/api/inventario/inventario-snapshots/cron/route.ts` | Si | Guardar snapshot diario de inventario. | RPC `inventario_actual`, `inventario_snapshots` |
| `GET` | `/inventario/api/export/[id]` | `app/inventario/api/export/[id]/route.ts` | No, usa anon key | Generar PDF simple de pedido. | `pedidos`, `pedido_items`, `materiales`, `pdfkit` |

## Contratos y comportamiento relevante

### `POST /api/pedidos`

- Valida payload con `zod`.
- Rechaza:
  - materiales repetidos,
  - kilos negativos,
  - kilos inconsistentes para `bulto`,
  - kilos omitidos o distintos para `litro`,
  - `kg` presente en materiales por `unidad`.
- Inserta primero `pedidos`, luego `pedido_items`.
- Si falla la insercion de items, elimina el pedido creado.

### `GET /api/inventario`

- Si recibe `zonaId`, devuelve solo esa zona.
- Si no recibe `zonaId`, recorre todas las zonas activas y concatena resultados.
- En ambos casos enriquece `zona_nombre` cuando la RPC no lo entrega.

### `POST /api/canastillas`

- Valida cantidades, longitud de textos y formato de firma.
- Acepta firmas `image/png` y `image/jpeg`.
- Sube la firma a storage privado.
- Persiste una fila por item en tabla `canastillas`.

### `GET /inventario/api/export/[id]`

- Fuerza `runtime = "nodejs"`.
- Genera un PDF tabular minimalista.
- Usa el cliente `supabase` basado en `anon key`, no `service role`.

## Jobs programados

`vercel.json` define los siguientes cron jobs:

| Horario | Ruta | Estado observado |
| --- | --- | --- |
| `0 22 * * *` | `/api/consumo/cron` | Ruta inexistente en el repo. |
| `0 23 * * *` | `/api/inventario/inventario-snapshots/cron` | Implementado. |
| `0 12 * * *` | `/api/inventario/alerta-criticos/cron` | Implementado. |

## Rutas no expuestas o ambiguas

| Archivo | Situacion |
| --- | --- |
| `lib/reservas/route.ts` | Tiene forma de route handler, pero no es accesible por HTTP porque no vive en `app/api`. |
| `/auth/login` | Referenciado por `app/layout.tsx`, pero no existe como pagina. |

## Middleware

**Archivo:** `middleware.ts`

### Comportamiento real

- Bloquea cualquier ruta que empiece por `/pconsumo`.
- Deja pasar el resto de solicitudes.
- No implementa autenticacion ni autorizacion.

## Autorizacion observada

No hay validaciones explicitas por rol o sesion en las rutas web ni en la mayoria de APIs. El repositorio asume que la proteccion vendra de:

- politicas RLS de Supabase,
- restricciones del entorno,
- y/o una capa externa de red.

Si esa proteccion externa no existe, endpoints como `/api/admin/users` y paginas como `/admin/users` quedan expuestos por diseño del codigo actual.
