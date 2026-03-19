# Documentacion Tecnica Integral

## 1. Proposito del sistema

`pedidos-materia-prima-main` es una aplicacion web interna para operaciones de planta. Centraliza tres dominios que antes suelen vivir dispersos en hojas de calculo o procesos manuales:

1. Pedidos de materia prima por zona o planta.
2. Inventario operativo de materiales, cobertura y consumos manuales.
3. Prestamos y devoluciones de canastillas con firma digital.

El proyecto esta construido con `Next.js 15`, usa `React 19` y `TypeScript`, y delega la persistencia, auth, storage y varias operaciones de negocio a `Supabase`.

Este archivo es el documento tecnico canonico del repositorio. La carpeta `docs/` contiene material previo que sirvio de base, pero la referencia principal para el equipo tecnico debe ser este `README.md`.

## 2. Audiencia y alcance

Este documento esta pensado para:

- desarrollo y mantenimiento del producto,
- soporte operativo,
- despliegue y administracion tecnica,
- analisis de dependencias con Supabase,
- onboarding tecnico.

No cubre procesos de negocio fuera del codigo ni sustituye configuraciones externas de Supabase que hoy no estan versionadas en el repositorio.

## 3. Resumen ejecutivo

La aplicacion funciona con una arquitectura `frontend + route handlers + Supabase`:

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

Automatizacion
  |- Vercel Cron
  `- PM2 como alternativa self-hosted
```

Los flujos mas importantes son:

- crear, editar, completar y deshacer pedidos;
- consultar y ajustar inventario por zona;
- registrar consumos manuales con fotos;
- generar snapshots diarios del inventario;
- enviar alertas por correo para materiales criticos sin pedido pendiente;
- registrar movimientos de canastillas con firma y gestionar proveedores.

## 4. Stack tecnico

### 4.1 Framework y runtime

| Componente | Version o enfoque | Uso |
| --- | --- | --- |
| `Next.js` | `15.5.4` | App Router, rutas web, route handlers. |
| `React` | `19.1.0` | UI cliente. |
| `TypeScript` | `strict` | Tipado estatico. |
| `Turbopack` | habilitado | Desarrollo y build. |

### 4.2 UI y experiencia

| Componente | Uso |
| --- | --- |
| `Tailwind CSS 4` | Estilos base. |
| `Radix UI` | Dialog, tabs, popover y primitives. |
| `shadcn/ui` style | Componentes base bajo `components/ui/*`. |
| `lucide-react` | Iconografia. |

### 4.3 Integracion y utilidades

| Dependencia | Uso |
| --- | --- |
| `@supabase/supabase-js` | Cliente browser y servidor. |
| `zod` | Validacion de payloads API. |
| `pdfkit`, `jspdf`, `html-to-image`, `dom-to-image-more`, `html2canvas` | Exportes PDF y PNG. |
| `date-fns` | Fechas. |
| `recharts` | Visualizaciones. |
| `react-hook-form` | Formularios. |

### 4.4 Servicios externos

| Servicio | Rol |
| --- | --- |
| `Supabase Database` | Tablas operativas, joins, RPC y snapshots. |
| `Supabase Storage` | Fotos de consumo y firmas. |
| `Supabase Auth Admin` | Alta y gestion tecnica de usuarios. |
| `Resend` | Correo de alertas criticas. |
| `Vercel Cron` | Jobs programados diarios. |
| `PM2` | Alternativa de despliegue fuera de Vercel. |

## 5. Inicio rapido para desarrollo

### 5.1 Requisitos previos

- `Node.js 20` o superior recomendado.
- `npm` disponible localmente.
- proyecto `Supabase` ya creado y con esquema funcional;
- variables de entorno del proyecto;
- buckets y RPC definidos en Supabase.

### 5.2 Instalacion

```bash
npm install
```

### 5.3 Variables de entorno

Crear un archivo local no versionado, por ejemplo `.env.local`, con:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
ALERTA_CRITICA_FROM=
```

### 5.4 Ejecucion

```bash
npm run dev
```

Abrir `http://localhost:3000`.

### 5.5 Scripts disponibles

| Script | Uso |
| --- | --- |
| `npm run dev` | Desarrollo con Turbopack. |
| `npm run build` | Build de produccion. |
| `npm run start` | Ejecuta la app construida. |
| `npm run lint` | Ejecuta ESLint. |

## 6. Variables de entorno y consumo real

| Variable | Obligatoria | Consumida por | Comentario |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Si | `lib/supabase.ts`, `lib/supabasedamin.ts`, endpoints de alertas | Se usa tanto en browser como en servidor. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Si | cliente browser y fallback del endpoint de alertas criticas | Expuesta al cliente por diseno. |
| `SUPABASE_SERVICE_ROLE_KEY` | Si para backend real | casi todo `app/api/**`, storage, auth admin y cron | Necesaria para operaciones privilegiadas. |
| `RESEND_API_KEY` | Solo para correo | `app/api/inventario/alerta-criticos/cron/route.ts` | Sin esta variable falla el envio de alertas. |
| `ALERTA_CRITICA_FROM` | Solo para correo | `app/api/inventario/alerta-criticos/cron/route.ts` | Remitente del correo. |

Si faltan `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`, la app puede fallar al importarse porque `lib/supabase.ts` lanza una excepcion de inmediato.

## 7. Arquitectura del sistema

### 7.1 Principio general

No existe un backend separado del frontend. El backend del sistema es la combinacion de:

- pantallas de `Next.js`,
- route handlers de `Next.js`,
- operaciones directas desde el navegador a Supabase,
- RPC y tablas de Supabase,
- buckets de Storage,
- servicios externos como Resend.

### 7.2 Capas

#### Presentacion

- `app/layout.tsx` define layout general, header, navegacion y cierre de sesion.
- `app/page.tsx` muestra el dashboard.
- cada dominio vive en un segmento propio bajo `app/`.
- `components/ui/*` agrupa los primitives reutilizables.

#### Logica de negocio en frontend

La aplicacion resuelve buena parte del negocio en componentes cliente:

- calculo de cobertura,
- transformacion de inventario actual,
- armado de notas de auditoria,
- compresion de fotos,
- actualizacion y reversa de estados,
- cache local de pedidos.

Archivos importantes:

- `lib/cobertura.ts`
- `lib/consumo.ts`
- `lib/inventario-notas.ts`
- `lib/pedidos.ts`
- `app/pedidos/pedidosCache.ts`

#### Integracion servidor

Las operaciones que requieren privilegios o integracion externa pasan por `route handlers`:

- creacion validada de pedidos,
- lectura agregada de inventario por RPC,
- subida de fotos,
- firma y proveedores de canastillas,
- usuarios de Supabase Auth,
- cron jobs,
- generacion de signed URLs,
- exporte PDF.

#### Persistencia

Supabase concentra:

- tablas de negocio,
- joins y relaciones,
- RPC no versionadas en el repo,
- storage publico y privado,
- auth admin.

### 7.3 Decisiones tecnicas visibles

| Decision | Estado observado | Impacto |
| --- | --- | --- |
| Render dinamico | muchas paginas usan `export const dynamic = "force-dynamic"` | Prioriza consistencia frente a cache estatico. |
| Build tolerante | `next.config.ts` ignora errores de ESLint y TypeScript en build | Facilita deploy, pero permite publicar builds con problemas. |
| Cliente primero | muchas escrituras van directo desde browser a Supabase | Simplifica UI, pero reparte logica y controles. |
| Cache local puntual | existe una cache en memoria de pedidos con TTL | Mejora UX, pero no hay estrategia global de invalidacion. |

### 7.4 Runtimes especiales

- `app/inventario/api/export/[id]/route.ts` fuerza `runtime = "nodejs"` porque `pdfkit` no funciona en Edge.
- varias paginas y el exporte PDF fuerzan `dynamic = "force-dynamic"`.

## 8. Estructura del repositorio

| Ruta | Responsabilidad principal | Comentario |
| --- | --- | --- |
| `app/` | Pantallas y route handlers de Next.js | Es la superficie principal del producto. |
| `app/(dashboard)` | Hook y componentes del dashboard | Resume pedidos e inventario. |
| `app/pedidos` | Flujo de pedidos | Creacion, edicion, vista, listado y cache. |
| `app/inventario` | Operacion diaria de inventario | Modulo mas grande del repo. |
| `app/materiales` | CRUD de catalogo por zona | Configura materiales y consumo base. |
| `app/historial` | Consulta historica de pedidos | Filtrado por fecha y solicitante. |
| `app/canastillas` | Flujo de prestamos y devoluciones | Incluye firma y proveedores. |
| `app/admin/users` | UI tecnica de usuarios | Usa Supabase Auth Admin. |
| `components/` | Componentes compartidos | Incluye `MaterialPicker`, `PageContainer`, `toastprovider`. |
| `components/ui/` | Primitives UI | Base reusable del sistema. |
| `lib/` | Utilidades, clientes Supabase y helpers de dominio | No existe una capa `services/` separada. |
| `docs/` | Documentacion fragmentada previa | Hoy debe considerarse material de apoyo. |
| `public/` | Assets estaticos | SVG y favicon. |
| `types/` | Declaraciones `.d.ts` | Soporte a librerias externas. |
| `ecosystem.config.js` | Configuracion PM2 | Apunta a un despliegue self-hosted. |
| `vercel.json` | Config Vercel y cron jobs | Incluye un cron apuntando a una ruta inexistente. |

## 9. Modulos funcionales

### 9.1 Dashboard principal

**Ruta:** `/`

Responsabilidades:

- mostrar pedidos pendientes;
- resumir materiales por nivel de cobertura;
- disparar notificaciones visuales cuando aparecen nuevos criticos;
- permitir completar pedidos desde el panel.

Archivos principales:

- `app/page.tsx`
- `app/(dashboard)/_hooks/use-dashboard-data.ts`
- `app/(dashboard)/_components/*`

Fuentes de datos:

- tabla `pedidos` y `pedido_items`,
- `GET /api/inventario`,
- calculos de cobertura locales.

### 9.2 Materiales

**Ruta:** `/materiales`

Responsabilidades:

- administrar el catalogo por zona;
- registrar unidad de medida;
- definir `presentacion_kg_por_bulto`;
- definir `tasa_consumo_diaria_kg`;
- marcar materiales como inactivos.

Reglas observadas:

- si la unidad es `bulto`, la presentacion en kg por bulto es obligatoria;
- si la unidad es `unidad` o `litro`, la presentacion se normaliza a `1`;
- la eliminacion es logica mediante `activo = false`.

### 9.3 Pedidos

**Rutas:** `/pedidos`, `/pedidos/nuevo`, `/pedidos/[id]`, `/pedidos/[id]/editar`, `/pedidos/[id]/ver`

Capacidades:

- listar pedidos por zona;
- crear pedidos nuevos;
- editar cabecera e items;
- cambiar estado manualmente;
- completar pedidos y reflejarlos en inventario;
- deshacer pedidos completados;
- exportar el pedido como PDF o vista lista para captura.

Estados observados:

```text
borrador -> enviado -> recibido -> completado
                ^         |
                |         |
                +---------+  reversa operativa
```

Notas importantes:

- el flujo principal moderno crea pedidos directamente en estado `enviado`;
- `borrador` sigue existiendo en tipos y codigo legacy, pero no domina el flujo principal;
- hay una cache en memoria por zona con TTL de 2 minutos en `app/pedidos/pedidosCache.ts`.

### 9.4 Inventario

**Ruta:** `/inventario`

Es el modulo operativo mas complejo del repositorio.

Capacidades:

- consultar inventario por zona;
- ver cobertura y fecha estimada de agotamiento;
- abrir historial de movimientos por material;
- ajustar stock absoluto con RPC;
- registrar consumos manuales;
- adjuntar hasta 3 fotos por consumo;
- deshacer consumos manuales;
- deshacer pedidos completados ya aplicados a inventario;
- detectar materiales criticos y validar si ya tienen pedido pendiente.

Dependencias principales:

- `GET /api/inventario`
- `POST /api/consumos/upload`
- `POST /api/inventario/alerta-criticos/pedidos`
- RPC `ajustar_stock_absoluto`
- tabla `movimientos_inventario`
- bucket `consumos`

Reglas operativas visibles:

- las fotos se comprimen en cliente hasta aproximadamente `0.5 MB` y `1600 px`;
- los consumos se registran como movimientos de tipo `salida`;
- deshacer un consumo genera un movimiento compensatorio `entrada`;
- deshacer un pedido completado genera movimientos `pedido_deshacer`.

### 9.5 Historial

**Ruta:** `/historial`

Responsabilidades:

- consultar pedidos completados o cancelados;
- filtrar por solicitante;
- filtrar por rango de fechas;
- agrupar por zona.

Fuente principal:

- tabla `pedidos`, filtrando por `estado = completado` o `cancelado_at IS NOT NULL`.

### 9.6 Consumo especial de salmuera

**Ruta:** `/Pconsumo`

Responsabilidades:

- registrar consumo manual de salmuera para `Desposte` y `Desprese`;
- controlar dias ya registrados en la semana actual;
- escribir movimientos `consumo_manual_salmuera`.

Estado real:

- la pantalla existe y funciona a nivel de codigo;
- `middleware.ts` bloquea cualquier acceso a `/pconsumo` con `403`;
- tecnicamente es un modulo implementado pero inhabilitado en runtime.

### 9.7 Canastillas

**Rutas:** `/canastillas`, `/canastillas/inventario`, `/canastillas/proveedores`

Capacidades:

- registrar prestamo o devolucion en un wizard;
- capturar firma digital;
- guardar firma en storage privado;
- consultar inventario e historial de canastillas;
- editar registros existentes;
- anular registros con motivo;
- gestionar proveedores.

Reglas visibles:

- `placa_vh` debe tener 6 caracteres alfanumericos;
- `consecutivo` debe ser numerico;
- la firma se almacena como `storage:<path>`;
- las firmas se consultan por signed URL temporal;
- el `DELETE` de proveedores intenta borrado fisico y, si falla, cae a baja logica.

### 9.8 Administracion de usuarios

**Ruta:** `/admin/users`

Capacidades:

- listar usuarios de Supabase Auth;
- crear usuarios;
- restablecer contrasenas.

Limitacion actual:

- no hay guardas explicitas de sesion o rol en la UI ni en la API;
- la UI expone un selector de rol, pero el endpoint `POST /api/admin/users` solo consume `email` y `password`.

## 10. Rutas web y endpoints

### 10.1 Rutas web

| Ruta | Archivo | Objetivo | Observaciones |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | Dashboard operativo | Resume cobertura y pedidos enviados. |
| `/materiales` | `app/materiales/page.tsx` | CRUD de materiales | Opera por zonas activas. |
| `/pedidos` | `app/pedidos/page.tsx` | Listado de pedidos | Usa tabs y cache local. |
| `/pedidos/nuevo` | `app/pedidos/nuevo/page.tsx` | Crear pedido | Llama `POST /api/pedidos`. |
| `/pedidos/[id]` | `app/pedidos/[id]/page.tsx` | Editar pedido | Permite cambiar items y estado. |
| `/pedidos/[id]/editar` | `app/pedidos/[id]/editar/page.tsx` | Alias de edicion | Reexporta la pagina principal del pedido. |
| `/pedidos/[id]/ver` | `app/pedidos/[id]/ver/page.tsx` | Vista de consulta y exporte | Complementa PDF y captura. |
| `/inventario` | `app/inventario/page.tsx` | Operacion de inventario | Principal modulo operativo. |
| `/historial` | `app/historial/page.tsx` | Historial de pedidos | Completados y cancelados. |
| `/canastillas` | `app/canastillas/page.tsx` | Wizard de prestamo o devolucion | Captura firma. |
| `/canastillas/inventario` | `app/canastillas/inventario/page.tsx` | Inventario e historial de canastillas | Incluye anulaciones. |
| `/canastillas/proveedores` | `app/canastillas/proveedores/page.tsx` | CRUD de proveedores | Usa API dedicada. |
| `/Pconsumo` | `app/Pconsumo/page.tsx` | Consumo especial de salmuera | Bloqueada por `middleware.ts`. |
| `/admin/users` | `app/admin/users/page.tsx` | Admin tecnica de usuarios | Sin guardas explicitas. |

### 10.2 Route handlers

| Metodo | Ruta | Archivo | Proposito | Dependencias principales |
| --- | --- | --- | --- | --- |
| `POST` | `/api/pedidos` | `app/api/pedidos/route.ts` | Crear pedido validado | `zonas`, `materiales`, `pedidos`, `pedido_items` |
| `GET` | `/api/inventario` | `app/api/inventario/route.ts` | Obtener inventario actual | RPC `inventario_actual`, `zonas` |
| `POST` | `/api/consumos/upload` | `app/api/consumos/upload/route.ts` | Subir fotos de consumo | bucket `consumos` |
| `GET` | `/api/admin/users` | `app/api/admin/users/route.ts` | Listar usuarios | Supabase Auth Admin |
| `POST` | `/api/admin/users` | `app/api/admin/users/route.ts` | Crear usuario | Supabase Auth Admin |
| `PUT` | `/api/admin/users` | `app/api/admin/users/route.ts` | Cambiar contrasena | Supabase Auth Admin |
| `POST` | `/api/canastillas` | `app/api/canastillas/route.ts` | Guardar registros de canastillas con firma | bucket `canastillas-firmas`, tabla `canastillas` |
| `POST` | `/api/canastillas/firma` | `app/api/canastillas/firma/route.ts` | Generar signed URL temporal | bucket `canastillas-firmas` |
| `POST` | `/api/canastillas/proveedores` | `app/api/canastillas/proveedores/route.ts` | Crear proveedor | `canastillas_proveedores` |
| `PUT` | `/api/canastillas/proveedores` | `app/api/canastillas/proveedores/route.ts` | Editar proveedor | `canastillas_proveedores` |
| `DELETE` | `/api/canastillas/proveedores` | `app/api/canastillas/proveedores/route.ts` | Eliminar o desactivar proveedor | `canastillas_proveedores` |
| `POST` | `/api/inventario/alerta-criticos/pedidos` | `app/api/inventario/alerta-criticos/pedidos/route.ts` | Verificar materiales criticos con pedido pendiente | `pedidos`, `pedido_items` |
| `GET` | `/api/inventario/alerta-criticos/cron` | `app/api/inventario/alerta-criticos/cron/route.ts` | Enviar alertas criticas por correo | RPC `inventario_actual`, `alertas_criticos_envios`, Resend |
| `GET` | `/api/inventario/inventario-snapshots` | `app/api/inventario/inventario-snapshots/route.ts` | Consultar snapshots | `inventario_snapshots` |
| `GET` | `/api/inventario/inventario-snapshots/cron` | `app/api/inventario/inventario-snapshots/cron/route.ts` | Generar snapshot diario | RPC `inventario_actual`, `inventario_snapshots` |
| `GET` | `/inventario/api/export/[id]` | `app/inventario/api/export/[id]/route.ts` | Generar PDF tabular del pedido | `pedidos`, `pedido_items`, `materiales`, `pdfkit` |

### 10.3 Reglas relevantes por endpoint

#### `POST /api/pedidos`

- valida payload con `zod`;
- rechaza materiales repetidos;
- valida consistencia de `kg` segun la unidad de medida;
- crea primero `pedidos` y luego `pedido_items`;
- si fallan los items, elimina el pedido ya creado.

#### `GET /api/inventario`

- acepta `zonaId` opcional;
- si no recibe zona, consulta todas las zonas activas;
- usa la RPC `inventario_actual`;
- enriquece `zona_nombre` si la RPC no lo trae.

#### `POST /api/canastillas`

- valida firma, fecha, cantidad y longitudes de texto;
- acepta `image/png` y `image/jpeg`;
- sube la firma a storage privado;
- crea una fila por item en `canastillas`.

#### `POST /api/consumos/upload`

- asegura que el bucket `consumos` exista;
- sube el archivo;
- responde con URL publica.

#### `GET /inventario/api/export/[id]`

- usa `runtime = "nodejs"`;
- genera un PDF simple con `pdfkit`;
- consulta con el cliente `supabase` basado en `anon key`.

## 11. Modelo de datos esperado

### 11.1 Nota de alcance

El repositorio no incluye migraciones SQL ni contratos versionados de base de datos. Por eso, el esquema documentado aqui es una inferencia verificada contra:

- `select`,
- `insert`,
- `update`,
- `rpc`,
- y operaciones de storage realmente usadas por el codigo.

El repo por si solo no reconstruye la base de datos.

### 11.2 Entidades principales

#### `zonas`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador tecnico de zona o planta. |
| `nombre` | `string | null` | Nombre visible. |
| `activo` | `boolean` | Filtra zonas operativas. |

#### `materiales`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador del material. |
| `zona_id` | `string` | Relacion con `zonas`. |
| `nombre` | `string` | Nombre del material. |
| `presentacion_kg_por_bulto` | `number | null` | Conversion a kg. |
| `tasa_consumo_diaria_kg` | `number | null` | Base de calculo de cobertura. |
| `proveedor` | `string | null` | Informacion comercial y de exporte. |
| `activo` | `boolean` | Baja logica. |
| `unidad_medida` | `"bulto" | "unidad" | "litro"` | Semantica de cantidades. |

#### `pedidos`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador del pedido. |
| `zona_id` | `string | null` | Zona asociada. |
| `fecha_pedido` | `string` | Fecha base del pedido. |
| `fecha_entrega` | `string | null` | Fecha comprometida. |
| `solicitante` | `string | null` | Responsable del pedido. |
| `estado` | `"borrador" | "enviado" | "recibido" | "completado"` | Estado del flujo. |
| `total_bultos` | `number | null` | Resumen operativo. |
| `total_kg` | `number | null` | Resumen operativo. |
| `notas` | `string | null` | Observaciones. |
| `cancelado_at` | `string | null` | Soporte a historial. |
| `inventario_posteado` | `boolean | null` | Bandera usada en reversas. |

#### `pedido_items`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador del item. |
| `pedido_id` | `string` | Relacion con `pedidos`. |
| `material_id` | `string` | Relacion con `materiales`. |
| `bultos` | `number` | Cantidad solicitada. |
| `kg` | `number | null` | Equivalente en kg. |
| `notas_item` | `string | null` | Visible en codigo legacy. |

#### `movimientos_inventario`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador del movimiento. |
| `zona_id` | `string` | Zona afectada. |
| `material_id` | `string` | Material afectado. |
| `fecha` | `string` | Marca temporal principal. |
| `tipo` | `"entrada" | "salida"` | Direccion del movimiento. |
| `bultos` | `number | null` | Cantidad en unidad base. |
| `kg` | `number | null` | Cantidad equivalente. |
| `ref_tipo` | `string | null` | Clasificador del origen. |
| `ref_id` | `string | null` | Referencia a otra entidad. |
| `notas` | `string | null` | Justificacion. |
| `dia_proceso` | `string | null` | Dia asociado a consumos. |
| `foto_url` | `string | null` | URL unica o lista serializada. |
| `created_at` | `string | null` | Orden cronologico fino. |

Valores observados en `ref_tipo`:

- `pedido`
- `pedido_deshacer`
- `consumo_manual_salmuera`
- `consumo_manual_agujas`
- `deshacer_consumo`
- `consumo_manual_anulado`

#### `inventario_snapshots`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador tecnico. |
| `fecha` | `string` | Fecha del snapshot. |
| `bultos` | `number | null` | Stock capturado. |
| `kg` | `number | null` | Stock capturado. |
| `material_id` | `string` | Material fotografiado. |
| `zona_id` | `string` | Zona fotografiada. |
| `created_at` | `string | null` | Trazabilidad. |

#### `canastillas`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador del registro. |
| `consecutivo` | `string | null` | Consecutivo de proveedor o remision. |
| `fecha` | `string` | Fecha principal. |
| `fecha_devolucion` | `string | null` | Marca devoluciones. |
| `placa_vh` | `string | null` | Vehiculo asociado. |
| `tipo_canastilla` | `string` | Tipo de canastilla. |
| `nombre_cliente` | `string | null` | Cliente asociado. |
| `proveedor` | `string` | Proveedor. |
| `cantidad` | `number` | Numero de canastillas. |
| `nombre_autoriza` | `string` | Responsable que autoriza. |
| `observaciones` | `string | null` | Texto libre. |
| `firma` | `string | null` | `storage:<path>` o base64 historico. |
| `anulado` | `boolean | null` | Baja logica. |
| `fecha_anulacion` | `string | null` | Trazabilidad de anulacion. |
| `motivo_anulacion` | `string | null` | Motivo. |

#### `canastillas_proveedores`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador del proveedor. |
| `nombre` | `string` | Nombre visible. |
| `contacto` | `string | null` | Contacto. |
| `telefono` | `string | null` | Telefono. |
| `notas` | `string | null` | Observaciones. |
| `activo` | `boolean | null` | Baja logica. |

#### `alertas_criticos_envios`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador tecnico. |
| `fecha` | `string` | Dia del envio. |
| `total` | `number` | Total de materiales enviados. |
| `destinatarios` | `string[] | json` | Correos destino. |
| `detalle` | `json` | Materiales incluidos. |

#### `consumo_automatico_reservas`

`lib/reservas/route.ts` asume una fuente llamada `consumo_automatico_reservas` con estos campos:

| Campo | Tipo esperado |
| --- | --- |
| `zona_id` | `string` |
| `material_id` | `string` |
| `stock_kg` | `number | null` |
| `stock_bultos` | `number | null` |
| `updated_at` | `string | null` |
| `material` | join a `materiales` |

No es posible confirmar desde el repo si es tabla o vista.

### 11.3 Relaciones de negocio

| Relacion | Tipo |
| --- | --- |
| `zonas -> materiales` | 1:N |
| `zonas -> pedidos` | 1:N |
| `pedidos -> pedido_items` | 1:N |
| `materiales -> pedido_items` | 1:N |
| `zonas -> movimientos_inventario` | 1:N |
| `materiales -> movimientos_inventario` | 1:N |
| `zonas + materiales -> inventario_snapshots` | N:N historificada |
| `canastillas_proveedores -> canastillas` | 1:N logico por nombre |

### 11.4 RPC requeridas

#### `inventario_actual(p_zona)`

Usada por:

- `GET /api/inventario`
- cron de snapshots
- cron de alertas criticas

Campos esperados:

| Campo | Tipo esperado |
| --- | --- |
| `zona_id` | `string` |
| `zona_nombre` | `string | null` |
| `material_id` | `string` |
| `nombre` | `string` |
| `unidad_medida` | `"bulto" | "unidad" | "litro"` |
| `presentacion_kg_por_bulto` | `number | null` |
| `tasa_consumo_diaria_kg` | `number | null` |
| `stock` | `number` |
| `stock_kg` | `number` |
| `stock_bultos` | `number` |

#### `ajustar_stock_absoluto(p_zona, p_material, p_nuevo_stock)`

Usada por:

- `app/inventario/page.tsx`

Efecto esperado:

- dejar el stock final exactamente en el valor indicado y registrar el ajuste correspondiente.

### 11.5 Buckets requeridos

| Bucket | Visibilidad | Uso |
| --- | --- | --- |
| `consumos` | publico | fotos de consumos manuales |
| `canastillas-firmas` | privado | firmas del modulo de canastillas |

## 12. Flujos operativos clave

### 12.1 Creacion y completado de pedidos

1. El usuario crea un pedido en `/pedidos/nuevo`.
2. `POST /api/pedidos` valida la zona, los materiales y la consistencia de cantidades.
3. Se insertan `pedidos` y `pedido_items`.
4. El pedido nace en estado `enviado`.
5. Cuando se completa, se generan movimientos de inventario tipo `entrada` con `ref_tipo = "pedido"`.
6. El pedido pasa a estado `completado`.

### 12.2 Reversa de pedido completado

1. La UI identifica el pedido completado a revertir.
2. Busca movimientos previos de inventario asociados al pedido.
3. Inserta movimientos compensatorios `salida` con `ref_tipo = "pedido_deshacer"`.
4. Intenta dejar el pedido en `recibido`.
5. Si falla por restricciones, intenta dejarlo en `enviado`.

### 12.3 Operacion de inventario

1. La UI consulta `/api/inventario?zonaId=<id>`.
2. El endpoint llama `inventario_actual`.
3. El frontend recalcula cobertura y fecha estimada.
4. El usuario puede ajustar stock absoluto mediante `ajustar_stock_absoluto`.
5. El usuario puede registrar consumos manuales con notas y fotos.
6. Cada movimiento queda en `movimientos_inventario`.

### 12.4 Consumo manual con fotos

1. La UI comprime hasta 3 imagenes.
2. Cada foto se sube a `/api/consumos/upload`.
3. El endpoint garantiza la existencia del bucket `consumos`.
4. Se guarda el movimiento de inventario con `foto_url`.
5. Si se deshace el consumo, el sistema intenta eliminar las fotos previas.

### 12.5 Canastillas con firma

1. El usuario completa el wizard de ingreso o devolucion.
2. Firma en canvas.
3. `POST /api/canastillas` valida payload y firma.
4. La firma se sube a `canastillas-firmas`.
5. Se insertan filas en tabla `canastillas`.
6. La vista de inventario resuelve la firma mediante `/api/canastillas/firma`.

### 12.6 Snapshots diarios

1. Vercel ejecuta `/api/inventario/inventario-snapshots/cron`.
2. El endpoint busca zonas activas objetivo.
3. Consulta `inventario_actual` por cada zona.
4. Hace `upsert` en `inventario_snapshots` por `fecha, material_id, zona_id`.

### 12.7 Alertas de cobertura critica

1. Vercel ejecuta `/api/inventario/alerta-criticos/cron`.
2. El endpoint calcula cobertura por material.
3. Filtra materiales con cobertura `<= 3` dias.
4. Descarta materiales que ya tengan pedido pendiente.
5. Envia correo por Resend.
6. Registra el envio en `alertas_criticos_envios` si la tabla existe.

## 13. Cobertura, reglas y criterios de negocio visibles

### 13.1 Reglas de cantidades por unidad

- `bulto`: `kg` debe coincidir con `bultos * presentacion_kg_por_bulto`.
- `litro`: `kg` debe coincidir con la cantidad registrada.
- `unidad`: `kg` debe omitirse o ir en `null`.

### 13.2 Regla de unicidad dentro de un pedido

- un pedido no debe repetir materiales.

### 13.3 Reglas de canastillas

- `consecutivo` numerico;
- `placa_vh` con 6 caracteres alfanumericos;
- firma en PNG o JPEG;
- cantidad maxima validada en API: `5000`.

### 13.4 Umbrales de cobertura no centralizados

El codigo usa mas de un criterio para decidir cuando un material es critico:

| Ubicacion | Critico | Alerta u observacion |
| --- | --- | --- |
| `lib/cobertura.ts` | `< 2` | `< 4` |
| `app/inventario/page.tsx` | `<= 3` | no aplica |
| `app/inventario/utils.ts` | `<= 2` | `<= 5` |
| `app/api/inventario/alerta-criticos/cron/route.ts` | `<= 3` | no aplica |

Esto es una deuda funcional activa y debe considerarse al interpretar reportes.

## 14. Despliegue y operacion

### 14.1 Vercel

`vercel.json` define:

- `buildCommand: next build --no-lint`
- cron jobs diarios

Cron jobs configurados:

| Horario | Ruta | Estado actual |
| --- | --- | --- |
| `0 22 * * *` | `/api/consumo/cron` | Inconsistente: la ruta no existe en el repo. |
| `0 23 * * *` | `/api/inventario/inventario-snapshots/cron` | Implementado. |
| `0 12 * * *` | `/api/inventario/alerta-criticos/cron` | Implementado. |

### 14.2 PM2

`ecosystem.config.js` expone una alternativa de despliegue self-hosted:

| Campo | Valor observado |
| --- | --- |
| `name` | `pedidos` |
| `script` | `npm` |
| `args` | `run start` |
| `cwd` | `/home/pedidos/pedidos_app` |
| `PORT` | `3000` |
| `max_memory_restart` | `400M` |

### 14.3 Build y calidad

`next.config.ts` incluye:

- `eslint.ignoreDuringBuilds = true`
- `typescript.ignoreBuildErrors = true`

Consecuencia:

- el build puede terminar exitosamente incluso si hay errores de lint o TypeScript.

### 14.4 Middleware

`middleware.ts` hoy:

- bloquea cualquier ruta que empiece por `/pconsumo`;
- deja pasar el resto del trafico;
- no implementa autenticacion ni autorizacion.

## 15. Seguridad y control de acceso

### 15.1 Lo que el codigo si hace

- valida payloads en varios endpoints con `zod`;
- separa algunas operaciones privilegiadas bajo `service role`;
- usa signed URLs para firmas privadas;
- evita rutas peligrosas en signed URLs de canastillas.

### 15.2 Lo que el codigo no hace explicitamente

- no hay guardas visibles de sesion en la mayoria de paginas;
- no hay control de roles explicito en `/admin/users`;
- no hay middleware de auth;
- no hay politicas RLS versionadas en el repo.

En la practica, la seguridad depende de configuraciones externas de Supabase y del entorno de despliegue.

## 16. Validacion tecnica recomendada

### 16.1 Smoke test local

Despues de levantar el proyecto, validar como minimo:

1. `/`
2. `/pedidos`
3. `/inventario`
4. `/canastillas`
5. `GET /api/inventario`

### 16.2 Checklist despues de desplegar

- la creacion de pedidos persiste en `pedidos` y `pedido_items`;
- completar un pedido genera movimientos de inventario;
- subir fotos crea archivos en `consumos`;
- guardar firmas crea archivos en `canastillas-firmas`;
- el cron de snapshots inserta o actualiza `inventario_snapshots`;
- el cron de alertas puede leer zonas y enviar correo;
- el modulo de usuarios puede listar usuarios si el acceso esta habilitado.

### 16.3 Automatizacion actual

Hoy el repositorio no tiene pruebas automatizadas.

La unica validacion incluida como script es:

```bash
npm run lint
```

## 17. Hallazgos, riesgos y deuda tecnica

### 17.1 Riesgos confirmados

- no hay migraciones SQL ni infraestructura de Supabase versionada;
- el build ignora errores de TypeScript y lint;
- `/Pconsumo` existe pero esta bloqueada por `middleware.ts`;
- `vercel.json` apunta a `/api/consumo/cron`, ruta inexistente;
- `app/layout.tsx` redirige a `/auth/login`, pero esa pagina no existe en el repo;
- no hay pruebas automatizadas;
- no hay guardas explicitas de autorizacion para `/admin/users` ni sus APIs;
- los umbrales de cobertura no estan centralizados;
- hay logica duplicada de completado y reversa de pedidos entre dashboard, inventario y modulo de pedidos.

### 17.2 Artefactos legacy o ambiguos

| Ruta o archivo | Situacion |
| --- | --- |
| `components/pedidos/PedidoEditorClient.tsx` | Editor antiguo sin referencias activas claras. |
| archivo legado bajo `app/pedidos/` con nombre no ASCII | Uso ambiguo y riesgo de friccion por encoding o tooling. |
| `lib/reservas/route.ts` | Parece route handler, pero no esta publicado bajo `app/api`. |
| `docs/*` | Material fragmentado previo, ya no deberia ser la referencia principal. |

## 18. Recomendaciones de mantenimiento

1. Versionar migraciones SQL, RPC, buckets y politicas RLS.
2. Definir una estrategia explicita de autenticacion y autorizacion.
3. Centralizar la logica de cobertura en un solo modulo.
4. Corregir o eliminar el cron `/api/consumo/cron`.
5. Resolver la ruta faltante `/auth/login` o ajustar el flujo de logout.
6. Agregar al menos `tsc --noEmit` y `npm run lint` en CI.
7. Depurar artefactos legacy para reducir ambiguedad.
8. Consolidar la logica de completado y reversa de pedidos en una sola capa reutilizable.

## 19. Fuente de verdad y limites de este documento

Este documento fue consolidado a partir del codigo fuente real del repositorio y de la documentacion fragmentada existente en `docs/`. Donde el repositorio no trae una definicion verificable, el texto lo declara como inferencia o dependencia externa.

Los principales limites actuales son:

- el esquema de Supabase no puede reconstruirse solo con este directorio;
- no hay contratos OpenAPI;
- no hay migraciones SQL;
- no hay politicas RLS versionadas;
- no hay trazabilidad automatica entre cambios de codigo y cambios de base de datos.
