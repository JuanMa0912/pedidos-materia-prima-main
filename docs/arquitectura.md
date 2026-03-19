# Arquitectura

## Vista general

La aplicacion combina render cliente con un backend ligero montado sobre Next.js y Supabase.

```text
Navegador
  ├─ Pantallas App Router (client components)
  ├─ Supabase JS con anon key
  └─ fetch a /api/*

Next.js Route Handlers
  ├─ Validacion con zod
  ├─ Supabase service role
  ├─ RPC inventario_actual / ajustar_stock_absoluto
  ├─ Storage buckets
  └─ Resend API

Supabase
  ├─ Tablas operativas
  ├─ Auth admin
  ├─ Buckets de storage
  └─ RPC / vistas

Planificador
  └─ Vercel Cron -> endpoints programados
```

## Capas del sistema

### 1. Presentacion

- `app/layout.tsx` define navegacion, header global y logout.
- `app/page.tsx` construye el dashboard principal con `useDashboardData`.
- Cada modulo de negocio vive bajo `app/<dominio>/`.
- `components/ui/*` contiene primitives de interfaz.

### 2. Logica de negocio en frontend

- `lib/consumo.ts` calcula consumo diario estimado en kg.
- `lib/cobertura.ts` agrupa materiales por nivel de cobertura.
- `lib/inventario-notas.ts` construye notas con stock antes/despues.
- `app/pedidos/pedidosCache.ts` mantiene cache en memoria por zona.

La logica de negocio no esta totalmente centralizada: varias pantallas recalculan cobertura, transforman inventario o reconstruyen notas localmente.

### 3. Integracion servidor

- `lib/supabase.ts` crea el cliente navegador con `anon key`.
- `lib/supabasedamin.ts` crea y cachea el cliente con `service role`.
- `app/api/**/route.ts` contiene las operaciones servidoras.

Casos que pasan por API propia:

- creacion validada de pedidos,
- lectura agregada de inventario por RPC,
- uploads a storage,
- administracion de usuarios,
- cron jobs,
- generacion de signed URLs,
- exporte PDF de pedido.

### 4. Persistencia y servicios externos

- Base de datos: Supabase.
- Storage publico: bucket `consumos`.
- Storage privado: bucket `canastillas-firmas`.
- Email: Resend.

## Estructura tecnica del repositorio

| Ruta | Papel tecnico | Comentario |
| --- | --- | --- |
| `app/(dashboard)` | Hook y componentes del home. | Resume inventario y pedidos enviados. |
| `app/pedidos` | Listado, creacion, edicion, vista y detalle/exporte de pedidos. | Dominio mas distribuido del repo. |
| `app/inventario` | Operacion diaria de inventario. | Archivo principal grande: `app/inventario/page.tsx`. |
| `app/materiales` | CRUD de materiales. | Administra catalogo por zona. |
| `app/historial` | Consulta historica de pedidos. | Filtra completados o cancelados. |
| `app/canastillas` | Flujo de prestamos/devoluciones y vistas de inventario. | Usa firmas y proveedores. |
| `app/api` | Backend HTTP del proyecto. | Mezcla endpoints operativos y cron. |
| `components` | Reutilizables generales. | `MaterialPicker` es clave para pedidos e inventario. |
| `lib` | Helpers puros y adaptadores. | No existe carpeta `services/` separada. |

## Flujos principales de datos

### Flujo de pedidos

1. La UI crea el pedido en `/pedidos/nuevo`.
2. `POST /api/pedidos` valida payload, zona y materiales.
3. Se insertan `pedidos` y `pedido_items`.
4. El pedido nace con estado `enviado`.
5. Al completar un pedido, se insertan movimientos de inventario tipo `entrada` con `ref_tipo = "pedido"` y luego se actualiza el estado a `completado`.
6. La reversa del completado genera movimientos `pedido_deshacer` y devuelve el estado a `recibido` o `enviado`.

### Flujo de inventario

1. La UI consulta `/api/inventario?zonaId=<id>`.
2. El endpoint llama la RPC `inventario_actual`.
3. El frontend recalcula cobertura y fecha estimada de agotamiento.
4. Ajustes y consumos escriben en `movimientos_inventario`.
5. Los snapshots diarios persisten estado consolidado en `inventario_snapshots`.

### Flujo de canastillas

1. El usuario completa datos de prestamo o devolucion.
2. La firma se captura en canvas y se envia como base64.
3. `POST /api/canastillas` valida, sube firma al bucket privado y crea registros en tabla `canastillas`.
4. La vista de inventario solicita URLs firmadas para mostrar firmas almacenadas.

## Decisiones tecnicas relevantes

### Cliente primero

La mayoria de pantallas son `client components`. Esto simplifica la interaccion operativa, pero traslada al navegador:

- parte importante de la composicion de datos,
- calculos de cobertura,
- manejo de estado de negocio,
- varias escrituras directas a Supabase usando la `anon key`.

### Render dinamico

Muchas pantallas exportan `dynamic = "force-dynamic"`, lo que desactiva cachas estaticas y favorece consistencia sobre costo de render.

### Build tolerante

`next.config.ts` tiene:

- `eslint.ignoreDuringBuilds = true`
- `typescript.ignoreBuildErrors = true`

Eso reduce friccion operativa, pero permite desplegar builds con problemas tipados o de lint.

### Caches locales

Solo existe una cache explicita:

- `app/pedidos/pedidosCache.ts`: cache en memoria por zona con TTL de 2 minutos.

No hay SWR, React Query ni invalidacion centralizada; se usa `CustomEvent("pedidos:invalidate")` en varios puntos.

## Dependencias de base de datos no versionadas en el repo

El proyecto requiere artefactos de Supabase definidos fuera del repositorio:

- RPC `inventario_actual`
- RPC `ajustar_stock_absoluto`
- tabla opcional `alertas_criticos_envios`
- tabla `inventario_snapshots`
- bucket `consumos`
- bucket `canastillas-firmas`

La ausencia de migraciones hace que la base de datos sea un prerequisito externo y no reproducible solo con este directorio.

## Tensiones y riesgos arquitectonicos

- No hay guards de sesion visibles en paginas ni APIs administrativas.
- `app/layout.tsx` asume una ruta `/auth/login` inexistente.
- `middleware.ts` bloquea `/pconsumo` aunque el modulo existe y sigue implementado.
- Los umbrales de cobertura no son consistentes:
  - `lib/cobertura.ts`: critico `< 2`, alerta `< 4`
  - `app/inventario/page.tsx`: critico `<= 3`
  - `app/inventario/utils.ts`: critico `<= 2`, observacion `<= 5`
  - `app/api/inventario/alerta-criticos/cron/route.ts`: critica `<= 3`
- Hay logica duplicada para completar y deshacer pedidos en `app/(dashboard)/_hooks/use-dashboard-data.ts`, `app/pedidos/pedidoszonas.tsx` y `app/inventario/page.tsx`.
