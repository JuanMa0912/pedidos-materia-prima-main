# Documentacion Tecnica

## 1. Proposito y alcance

Este documento es la referencia tecnica canonica de `pedidos-materia-prima-main`.

Describe:

- arquitectura del sistema;
- estructura del repositorio;
- modulos funcionales;
- rutas web y endpoints;
- modelo de datos esperado en Supabase;
- flujos operativos;
- despliegue, automatizacion y riesgos tecnicos.

La documentacion se construyo a partir del codigo fuente real del repositorio. Como el proyecto no incluye migraciones SQL ni contratos OpenAPI, varias partes del esquema de datos se documentan como inferencias verificadas contra consultas, inserts, RPC y buckets usados por la aplicacion.

## 2. Resumen ejecutivo

La aplicacion resuelve tres dominios principales:

1. Pedidos de materia prima por zona o planta.
2. Inventario operativo, cobertura y consumos manuales.
3. Prestamos y devoluciones de canastillas con firma digital.

Stack principal:

- `Next.js 15` con `App Router`
- `React 19` y `TypeScript`
- `Supabase` para database, auth, storage y RPC
- `Tailwind CSS 4`, `Radix UI` y componentes estilo `shadcn/ui`
- `zod` para validaciones
- `pdfkit`, `jsPDF` y utilidades HTML a imagen para exportes
- `Resend` para alertas criticas por correo

Arquitectura general:

```text
Navegador
  |- App Router y client components
  |- Supabase JS con anon key
  `- fetch a /api/*

Next.js
  |- Rutas web bajo app/
  |- Route handlers bajo app/api/
  |- Exporte PDF bajo app/inventario/api/export/[id]
  `- middleware.ts

Servicios externos
  |- Supabase Database
  |- Supabase Storage
  |- Supabase Auth Admin
  `- Resend
```

## 3. Arquitectura del sistema

### 3.1 Principio general

No existe un backend separado del frontend. El backend del sistema es la combinacion de:

- pantallas de `Next.js`,
- route handlers de `Next.js`,
- operaciones directas desde el navegador a Supabase,
- RPC y tablas de Supabase,
- buckets de Storage,
- integraciones externas como Resend.

### 3.2 Capas

| Capa | Responsabilidad |
| --- | --- |
| Presentacion | Layout, navegacion y pantallas de negocio bajo `app/`. |
| Logica cliente | Cobertura, armado de notas, compresion de fotos, estados y cache local. |
| Integracion servidor | Rutas API para validacion, service role, storage, cron y exportes. |
| Persistencia | Supabase Database, Storage, Auth Admin y RPC. |

### 3.3 Decisiones tecnicas relevantes

| Decision | Estado observado | Impacto |
| --- | --- | --- |
| Render dinamico | varias paginas usan `dynamic = "force-dynamic"` | Prioriza consistencia frente a cache estatico. |
| Build tolerante | `next.config.ts` ignora errores de ESLint y TypeScript | Facilita deploy, pero permite builds con problemas. |
| Cliente primero | muchas escrituras van directo desde browser a Supabase | Simplifica UI, pero reparte logica y controles. |
| Cache local puntual | existe una cache en memoria para pedidos por zona | Mejora UX, sin estrategia global de invalidacion. |

### 3.4 Dependencias externas no versionadas

El proyecto depende de artefactos definidos fuera del repositorio:

- RPC `inventario_actual`
- RPC `ajustar_stock_absoluto`
- buckets `consumos` y `canastillas-firmas`
- tabla `inventario_snapshots`
- tabla opcional `alertas_criticos_envios`
- politicas RLS y configuracion de auth de Supabase

## 4. Estructura del repositorio

| Ruta | Responsabilidad principal |
| --- | --- |
| `app/` | Pantallas y route handlers de Next.js. |
| `app/(dashboard)` | Hook y componentes del dashboard principal. |
| `app/pedidos` | Creacion, edicion, listado, vista y cache de pedidos. |
| `app/inventario` | Operacion diaria de inventario y exporte PDF. |
| `app/materiales` | CRUD de catalogo por zona. |
| `app/historial` | Historial de pedidos completados o cancelados. |
| `app/canastillas` | Flujo de prestamo o devolucion, inventario y proveedores. |
| `app/admin/users` | UI tecnica para usuarios de Supabase Auth. |
| `components/` | Componentes compartidos. |
| `components/ui/` | Primitives reutilizables. |
| `lib/` | Clientes Supabase y utilidades de dominio. |
| `docs/` | Documentacion del proyecto. |
| `public/` | Assets estaticos. |

Archivos transversales importantes:

- `app/layout.tsx`
- `middleware.ts`
- `next.config.ts`
- `vercel.json`
- `ecosystem.config.js`

## 5. Modulos funcionales

### Dashboard

**Ruta:** `/`

Responsabilidades:

- mostrar pedidos pendientes;
- resumir materiales por cobertura;
- notificar nuevos materiales criticos;
- permitir completar pedidos desde el panel.

Archivos principales:

- `app/page.tsx`
- `app/(dashboard)/_hooks/use-dashboard-data.ts`
- `app/(dashboard)/_components/*`

### Materiales

**Ruta:** `/materiales`

Responsabilidades:

- administrar materiales por zona;
- configurar unidad de medida;
- definir presentacion por bulto y tasa de consumo diaria;
- aplicar baja logica con `activo = false`.

### Pedidos

**Rutas:** `/pedidos`, `/pedidos/nuevo`, `/pedidos/[id]`, `/pedidos/[id]/editar`, `/pedidos/[id]/ver`

Capacidades:

- listar pedidos por zona;
- crear y editar pedidos;
- cambiar estado;
- completar pedidos y reflejar inventario;
- deshacer pedidos completados;
- exportar el pedido en PDF o vista imprimible.

Estados observados:

```text
borrador -> enviado -> recibido -> completado
                ^         |
                |         |
                +---------+  reversa operativa
```

El flujo principal moderno crea pedidos en estado `enviado`.

### Inventario

**Ruta:** `/inventario`

Es el modulo operativo mas complejo.

Capacidades:

- consultar inventario por zona;
- calcular cobertura y fecha estimada;
- ajustar stock absoluto con RPC;
- registrar consumos manuales;
- adjuntar hasta 3 fotos por consumo;
- deshacer consumos manuales;
- deshacer pedidos completados ya aplicados a inventario;
- validar materiales criticos con pedido pendiente.

### Historial

**Ruta:** `/historial`

Consulta pedidos completados o cancelados con filtros por solicitante y rango de fechas.

### Consumo especial de salmuera

**Ruta:** `/Pconsumo`

La pagina existe y registra movimientos `consumo_manual_salmuera`, pero `middleware.ts` bloquea cualquier acceso a `/pconsumo` con `403`.

### Canastillas

**Rutas:** `/canastillas`, `/canastillas/inventario`, `/canastillas/proveedores`

Capacidades:

- registrar prestamo o devolucion en un wizard;
- capturar firma digital;
- guardar firma en storage privado;
- consultar historial e inventario;
- editar y anular registros;
- gestionar proveedores.

### Administracion de usuarios

**Ruta:** `/admin/users`

Permite listar usuarios, crear usuarios y restablecer contrasenas con Supabase Auth Admin.

## 6. Rutas web y API

### 6.1 Rutas web principales

| Ruta | Objetivo |
| --- | --- |
| `/` | Dashboard operativo. |
| `/materiales` | CRUD de materiales. |
| `/pedidos` | Listado de pedidos por zona. |
| `/pedidos/nuevo` | Crear pedido. |
| `/pedidos/[id]` | Editar pedido. |
| `/pedidos/[id]/ver` | Vista de consulta y exporte. |
| `/inventario` | Operacion de inventario. |
| `/historial` | Historial de pedidos. |
| `/canastillas` | Wizard de canastillas. |
| `/canastillas/inventario` | Inventario e historial de canastillas. |
| `/canastillas/proveedores` | CRUD de proveedores. |
| `/Pconsumo` | Consumo especial de salmuera, hoy bloqueado. |
| `/admin/users` | Administracion tecnica de usuarios. |

### 6.2 Route handlers

| Metodo | Ruta | Proposito |
| --- | --- | --- |
| `POST` | `/api/pedidos` | Crear pedido validado. |
| `GET` | `/api/inventario` | Obtener inventario actual por zona o global. |
| `POST` | `/api/consumos/upload` | Subir fotos de consumo. |
| `GET/POST/PUT` | `/api/admin/users` | Listar usuarios, crear usuario, cambiar contrasena. |
| `POST` | `/api/canastillas` | Guardar canastillas con firma. |
| `POST` | `/api/canastillas/firma` | Generar signed URL para una firma. |
| `POST/PUT/DELETE` | `/api/canastillas/proveedores` | Crear, editar y eliminar o desactivar proveedor. |
| `POST` | `/api/inventario/alerta-criticos/pedidos` | Validar materiales criticos con pedido pendiente. |
| `GET` | `/api/inventario/alerta-criticos/cron` | Enviar alertas criticas por correo. |
| `GET` | `/api/inventario/inventario-snapshots` | Consultar snapshots. |
| `GET` | `/api/inventario/inventario-snapshots/cron` | Generar snapshot diario. |
| `GET` | `/inventario/api/export/[id]` | Generar PDF tabular del pedido. |

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
| `materiales` | Catalogo de materiales por zona. |
| `pedidos` | Cabecera del pedido. |
| `pedido_items` | Items de cada pedido. |
| `movimientos_inventario` | Entradas, salidas, consumos, reversas y ajustes. |
| `inventario_snapshots` | Foto diaria del inventario. |
| `canastillas` | Registros de prestamos y devoluciones. |
| `canastillas_proveedores` | Catalogo de proveedores. |
| `alertas_criticos_envios` | Historial de correos de alertas criticas. |

### 7.2 Campos clave por entidad

#### `materiales`

Campos visibles en el codigo:

- `id`
- `zona_id`
- `nombre`
- `presentacion_kg_por_bulto`
- `tasa_consumo_diaria_kg`
- `proveedor`
- `activo`
- `unidad_medida`

#### `pedidos`

Campos visibles en el codigo:

- `id`
- `zona_id`
- `fecha_pedido`
- `fecha_entrega`
- `solicitante`
- `estado`
- `total_bultos`
- `total_kg`
- `notas`
- `cancelado_at`
- `inventario_posteado`

#### `movimientos_inventario`

Campos visibles en el codigo:

- `id`
- `zona_id`
- `material_id`
- `fecha`
- `tipo`
- `bultos`
- `kg`
- `ref_tipo`
- `ref_id`
- `notas`
- `dia_proceso`
- `foto_url`
- `created_at`

Valores observados de `ref_tipo`:

- `pedido`
- `pedido_deshacer`
- `consumo_manual_salmuera`
- `consumo_manual_agujas`
- `deshacer_consumo`
- `consumo_manual_anulado`

### 7.3 RPC requeridas

| RPC | Uso |
| --- | --- |
| `inventario_actual(p_zona)` | Inventario consolidado actual para dashboard, inventario y cron. |
| `ajustar_stock_absoluto(p_zona, p_material, p_nuevo_stock)` | Ajuste de stock absoluto desde inventario. |

### 7.4 Buckets requeridos

| Bucket | Visibilidad | Uso |
| --- | --- | --- |
| `consumos` | publico | fotos de consumos manuales |
| `canastillas-firmas` | privado | firmas de canastillas |

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
- `/api/inventario/alerta-criticos/cron` detecta materiales con cobertura `<= 3`, valida pedidos pendientes y envia correo por Resend.

## 9. Despliegue y operacion

### 9.1 Variables de entorno

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente browser y servidor. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente browser y algunas lecturas sin service role. |
| `SUPABASE_SERVICE_ROLE_KEY` | Rutas API privilegiadas, storage y admin. |
| `RESEND_API_KEY` | Envio de alertas criticas por correo. |
| `ALERTA_CRITICA_FROM` | Remitente del correo de alertas. |

### 9.2 Cron jobs de `vercel.json`

| Horario | Ruta | Estado |
| --- | --- | --- |
| `0 22 * * *` | `/api/consumo/cron` | Ruta inexistente en el repo. |
| `0 23 * * *` | `/api/inventario/inventario-snapshots/cron` | Implementado. |
| `0 12 * * *` | `/api/inventario/alerta-criticos/cron` | Implementado. |

### 9.3 PM2

`ecosystem.config.js` define una alternativa de despliegue self-hosted con:

- nombre `pedidos`
- `npm run start`
- puerto `3000`
- reinicio por memoria en `400M`

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

Despues de levantar o desplegar la app, validar como minimo:

1. `/`
2. `/pedidos`
3. `/inventario`
4. `/canastillas`
5. `GET /api/inventario`
6. creacion de pedidos
7. carga de fotos de consumo
8. guardado de firmas de canastillas
