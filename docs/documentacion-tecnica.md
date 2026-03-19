# Documentacion Tecnica

## 1. Proposito y alcance

Este documento es la referencia tecnica canonica de `pedidos-materia-prima-main`. Resume arquitectura, estructura, modulos, rutas, modelo de datos esperado en Supabase, flujos, despliegue y riesgos.

La documentacion se construyo a partir del codigo fuente real del repositorio. Como el proyecto no incluye migraciones SQL ni contratos OpenAPI, varias partes del esquema se documentan como inferencias verificadas contra consultas, inserts, RPC y buckets usados por la aplicacion.

## 2. Resumen ejecutivo

La aplicacion cubre tres dominios: pedidos de materia prima por zona o planta, inventario operativo con cobertura y consumos manuales, y prestamos o devoluciones de canastillas con firma digital.

Stack principal: `Next.js 15`, `React 19`, `TypeScript`, `Supabase`, `Tailwind CSS 4`, `Radix UI`, `zod`, `pdfkit`, `jsPDF`, utilidades HTML a imagen y `Resend`.

Arquitectura general:

```text
Navegador
  |- App Router y client components
  |- Supabase JS con anon key
  `- fetch a /api/*

Next.js
  |- Rutas web y handlers bajo app/
  |- Exporte PDF bajo /inventario/api/export/[id]
  `- middleware.ts

Servicios externos
  |- Supabase Database / Storage / Auth Admin
  `- Resend
```

## 3. Arquitectura del sistema

### 3.1 Principio general

No existe un backend separado del frontend. La logica se reparte entre pantallas de `Next.js`, route handlers, llamadas directas a Supabase, RPC, Storage e integraciones externas.

### 3.2 Capas

- `Presentacion`: layouts, navegacion y pantallas bajo `app/`.
- `Cliente`: cobertura, armado de notas, compresion de fotos, estado local y cache puntual.
- `Servidor`: `/api/*`, exportes PDF, cron y operaciones con `service role`.
- `Persistencia`: Supabase Database, Storage, Auth Admin y RPC.

### 3.3 Decisiones tecnicas relevantes

- `Render dinamico`: varias paginas usan `dynamic = "force-dynamic"` para priorizar consistencia sobre cache estatico.
- `Build tolerante`: `next.config.ts` ignora errores de ESLint y TypeScript; facilita despliegue, pero permite builds con defectos.
- `Cliente primero`: muchas escrituras van directo del navegador a Supabase; simplifica la UI, pero dispersa controles.
- `Cache local`: existe una cache en memoria para pedidos por zona; mejora UX, pero sin invalidacion global.

### 3.4 Dependencias externas no versionadas

Elementos requeridos fuera del repositorio: RPC `inventario_actual` y `ajustar_stock_absoluto`, buckets `consumos` y `canastillas-firmas`, tabla `inventario_snapshots`, tabla opcional `alertas_criticos_envios`, y politicas RLS o configuracion de auth de Supabase.

## 4. Estructura del repositorio

| Ruta | Uso |
| --- | --- |
| `app/` | UI y handlers; incluye `(dashboard)`, `pedidos`, `inventario`, `materiales`, `historial`, `canastillas` y `admin/users`. |
| `components/` | Componentes compartidos y primitives en `components/ui/`. |
| `lib/` | Clientes Supabase y utilidades de dominio. |
| `docs/` | Documentacion del proyecto. |
| `public/` | Assets estaticos. |

Archivos transversales: `app/layout.tsx`, `middleware.ts`, `next.config.ts`, `vercel.json` y `ecosystem.config.js`.

## 5. Modulos funcionales

- `Dashboard` (`/`): pedidos pendientes, cobertura, materiales criticos y completado rapido.
- `Materiales` (`/materiales`): CRUD por zona, unidad, presentacion, tasa de consumo y baja logica.
- `Pedidos` (`/pedidos`, `/pedidos/nuevo`, `/pedidos/[id]`, `/pedidos/[id]/editar`, `/pedidos/[id]/ver`): listado, creacion, edicion, cambios de estado, completado, reversa y exporte. Flujo observado: `borrador -> enviado -> recibido -> completado`; el flujo actual crea en `enviado`.
- `Inventario` (`/inventario`): consulta, cobertura, ajuste por RPC, consumos manuales con fotos, deshacer consumos y reversa de pedidos ya aplicados.
- `Historial` (`/historial`): pedidos completados o cancelados con filtros por solicitante y fechas.
- `Pconsumo` (`/Pconsumo`): registra `consumo_manual_salmuera`, pero `middleware.ts` bloquea `/pconsumo` con `403`.
- `Canastillas` (`/canastillas`, `/canastillas/inventario`, `/canastillas/proveedores`): prestamos/devoluciones, firma digital, historial, inventario, edicion, anulacion y proveedores.
- `Admin users` (`/admin/users`): listar, crear usuarios y restablecer contrasenas con Supabase Auth Admin.

## 6. Rutas web y API

### 6.1 Rutas web principales

- `Operacion`: `/`, `/inventario`, `/historial`.
- `Pedidos`: `/pedidos`, `/pedidos/nuevo`, `/pedidos/[id]`, `/pedidos/[id]/editar`, `/pedidos/[id]/ver`.
- `Canastillas`: `/canastillas`, `/canastillas/inventario`, `/canastillas/proveedores`.
- `Catalogos y admin`: `/materiales`, `/admin/users`.
- `Especial`: `/Pconsumo` existe, pero hoy esta bloqueada.

### 6.2 Route handlers

- `POST /api/pedidos`: crear pedido validado.
- `GET /api/inventario`: obtener inventario actual por zona o global.
- `POST /api/consumos/upload`: subir fotos de consumo.
- `GET/POST/PUT /api/admin/users`: listar usuarios, crear usuario y cambiar contrasena.
- `POST /api/canastillas`: guardar canastillas con firma.
- `POST /api/canastillas/firma`: generar signed URL para una firma.
- `POST/PUT/DELETE /api/canastillas/proveedores`: crear, editar y eliminar o desactivar proveedor.
- `POST /api/inventario/alerta-criticos/pedidos`: validar materiales criticos con pedido pendiente.
- `GET /api/inventario/alerta-criticos/cron`: enviar alertas criticas por correo.
- `GET /api/inventario/inventario-snapshots`: consultar snapshots.
- `GET /api/inventario/inventario-snapshots/cron`: generar snapshot diario.
- `GET /inventario/api/export/[id]`: generar PDF tabular del pedido.

### 6.3 Reglas relevantes de API

- `POST /api/pedidos` valida cantidades segun unidad y evita materiales repetidos.
- `GET /api/inventario` usa la RPC `inventario_actual`.
- `POST /api/canastillas` valida firma, fecha, cantidad y formato de datos.
- `POST /api/consumos/upload` asegura que el bucket `consumos` exista.
- `GET /inventario/api/export/[id]` usa runtime Node por dependencia de `pdfkit`.

## 7. Modelo de datos esperado

### 7.1 Tablas principales

| Tabla | Proposito |
| --- | --- |
| `zonas` | Plantas o zonas operativas. |
| `materiales` | Catalogo por zona. |
| `pedidos` | Cabecera del pedido. |
| `pedido_items` | Items del pedido. |
| `movimientos_inventario` | Entradas, salidas, consumos, reversas y ajustes. |
| `inventario_snapshots` | Foto diaria del inventario. |
| `canastillas` | Prestamos y devoluciones. |
| `canastillas_proveedores` | Catalogo de proveedores. |
| `alertas_criticos_envios` | Historial de alertas criticas. |

### 7.2 Campos clave observados

| Entidad | Campos |
| --- | --- |
| `materiales` | `id`, `zona_id`, `nombre`, `presentacion_kg_por_bulto`, `tasa_consumo_diaria_kg`, `proveedor`, `activo`, `unidad_medida` |
| `pedidos` | `id`, `zona_id`, `fecha_pedido`, `fecha_entrega`, `solicitante`, `estado`, `total_bultos`, `total_kg`, `notas`, `cancelado_at`, `inventario_posteado` |
| `movimientos_inventario` | `id`, `zona_id`, `material_id`, `fecha`, `tipo`, `bultos`, `kg`, `ref_tipo`, `ref_id`, `notas`, `dia_proceso`, `foto_url`, `created_at` |

Valores observados de `ref_tipo`:

`pedido`, `pedido_deshacer`, `consumo_manual_salmuera`, `consumo_manual_agujas`, `deshacer_consumo` y `consumo_manual_anulado`.

### 7.3 RPC requeridas

| RPC | Uso |
| --- | --- |
| `inventario_actual(p_zona)` | Inventario consolidado actual para dashboard, inventario y cron. |
| `ajustar_stock_absoluto(p_zona, p_material, p_nuevo_stock)` | Ajuste de stock absoluto desde inventario. |

### 7.4 Buckets requeridos

- `consumos` (publico): fotos de consumos manuales.
- `canastillas-firmas` (privado): firmas de canastillas.

## 8. Flujos operativos clave

### Creacion y completado de pedidos

1. El usuario crea un pedido en `/pedidos/nuevo`.
2. `POST /api/pedidos` valida la zona, los materiales y las cantidades.
3. Se insertan `pedidos` y `pedido_items`.
4. El pedido nace en estado `enviado`.
5. Al completar el pedido, se insertan movimientos `entrada` con `ref_tipo = "pedido"`.

### Reversa de pedido completado

1. La UI identifica los movimientos asociados al pedido.
2. Inserta movimientos compensatorios `salida` con `ref_tipo = "pedido_deshacer"`.
3. Intenta devolver el pedido a `recibido`; si falla, cae a `enviado`.

### Operacion de inventario

1. La UI consulta `/api/inventario`.
2. El endpoint llama `inventario_actual`.
3. El frontend recalcula cobertura.
4. El usuario puede ajustar stock, registrar consumo o deshacer movimientos.

### Consumo manual con fotos

1. La UI comprime hasta 3 imagenes.
2. Sube cada foto a `/api/consumos/upload`.
3. Registra el movimiento en `movimientos_inventario`.
4. Si se deshace el consumo, intenta eliminar las fotos previas.

### Canastillas con firma

1. El usuario completa el wizard.
2. Firma en canvas.
3. `POST /api/canastillas` valida payload y firma.
4. La firma se sube a `canastillas-firmas`.
5. La vista de inventario resuelve la firma por signed URL.

### Snapshots y alertas

- `/api/inventario/inventario-snapshots/cron` hace `upsert` diario en `inventario_snapshots`.
- `/api/inventario/alerta-criticos/cron` detecta materiales con cobertura `<= 3`, valida pedidos pendientes y envia correo por `Resend`.

## 9. Despliegue y operacion

### 9.1 Variables de entorno

- `NEXT_PUBLIC_SUPABASE_URL`: cliente browser y servidor.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: cliente browser y algunas lecturas sin service role.
- `SUPABASE_SERVICE_ROLE_KEY`: rutas API privilegiadas, storage y admin.
- `RESEND_API_KEY`: envio de alertas criticas por correo.
- `ALERTA_CRITICA_FROM`: remitente del correo de alertas.

### 9.2 Cron jobs de `vercel.json`

- `0 22 * * *` -> `/api/consumo/cron`: ruta inexistente en el repo.
- `0 23 * * *` -> `/api/inventario/inventario-snapshots/cron`: implementado.
- `0 12 * * *` -> `/api/inventario/alerta-criticos/cron`: implementado.

### 9.3 PM2

`ecosystem.config.js` define una alternativa self-hosted con app `pedidos`, comando `npm run start`, puerto `3000` y reinicio por memoria en `400M`.

## 10. Riesgos y deuda tecnica

Riesgos confirmados en el codigo:

- no hay migraciones SQL ni infraestructura de Supabase versionada;
- el build ignora errores de TypeScript y lint;
- `/Pconsumo` existe pero esta bloqueada por `middleware.ts`;
- `vercel.json` apunta a `/api/consumo/cron`, ruta inexistente;
- `app/layout.tsx` redirige a `/auth/login`, pero esa pagina no existe;
- no hay pruebas automatizadas;
- no hay guardas explicitas de autorizacion para `/admin/users`;
- los umbrales de cobertura no estan centralizados;
- hay logica duplicada de completado y reversa de pedidos.

Artefactos legacy o ambiguos:

- `components/pedidos/PedidoEditorClient.tsx`
- archivo legado bajo `app/pedidos/` con nombre no ASCII
- `lib/reservas/route.ts`, con forma de route handler pero fuera de `app/api`

## 11. Recomendaciones de mantenimiento

1. Versionar migraciones SQL, RPC, buckets y politicas RLS.
2. Definir una estrategia explicita de autenticacion y autorizacion.
3. Centralizar la logica de cobertura en un solo modulo.
4. Corregir o eliminar el cron `/api/consumo/cron`.
5. Resolver la ruta faltante `/auth/login` o ajustar el flujo de logout.
6. Agregar al menos `tsc --noEmit` y `npm run lint` en CI.
7. Depurar artefactos legacy para reducir ambiguedad.

## 12. Validacion minima recomendada

Despues de levantar o desplegar la app, validar como minimo: `/`, `/pedidos`, `/inventario`, `/canastillas`, `GET /api/inventario`, creacion de pedidos, carga de fotos de consumo y guardado de firmas de canastillas.
