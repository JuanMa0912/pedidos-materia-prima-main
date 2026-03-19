# Indice Tecnico

Esta documentacion fue construida a partir del codigo fuente actual del repositorio. No hay migraciones SQL, diagramas ni contratos OpenAPI versionados, por lo que el modelo de datos y varias dependencias de Supabase se documentan como inferencias verificadas contra consultas, inserts, RPC y buckets usados por la aplicacion.

## Resumen ejecutivo

`pedidos-materia-prima-main` es una aplicacion de operaciones internas para Mercamio. La app concentra tres dominios principales:

1. Pedidos de materia prima por planta.
2. Inventario y cobertura de materiales.
3. Prestamos y devoluciones de canastillas con firma digital.

La arquitectura privilegia componentes cliente y consultas directas a Supabase desde el navegador. Las rutas `app/api/**` encapsulan los casos que requieren `service role`, cron, validaciones fuertes, storage o integracion externa con correo.

## Mapa de documentos

| Documento | Enfoque | Contenido |
| --- | --- | --- |
| [arquitectura.md](./arquitectura.md) | Explicacion | Capas, flujo de datos, decisiones tecnicas y estructura del repo. |
| [modulos-funcionales.md](./modulos-funcionales.md) | Explicacion + referencia | Responsabilidades de cada pantalla y flujo operativo. |
| [api-y-rutas.md](./api-y-rutas.md) | Referencia | Rutas web, endpoints, cron jobs y contratos operativos. |
| [modelo-de-datos.md](./modelo-de-datos.md) | Referencia | Tablas, relaciones, enums, RPC y buckets requeridos. |
| [operacion-y-despliegue.md](./operacion-y-despliegue.md) | How-to + referencia | Setup, variables, despliegue, cron y gaps operativos. |

## Mapa del repositorio

| Ruta | Responsabilidad | Notas |
| --- | --- | --- |
| `app/` | Pantallas, layout y route handlers de Next.js. | Contiene la mayor parte de la logica funcional. |
| `components/` | Componentes reutilizables UI y widgets compartidos. | Incluye base `ui/` y un editor legacy de pedidos. |
| `lib/` | Utilidades de dominio, formato, notas de inventario y clientes Supabase. | Tambien contiene `lib/reservas/route.ts`, que no esta expuesto como API. |
| `public/` | Iconos SVG estaticos. | No hay assets de negocio. |
| `types/` | Declaraciones `.d.ts` para librerias externas. | Soporte a `browser-image-compression` y `dom-to-image-more`. |
| `app/docs/mercamio-branding.md` | Lineamientos visuales. | Documento de branding, no de ejecucion. |
| `.claude/settings.local.json` | Permisos locales del asistente en IDE. | No participa en runtime. |
| `ecosystem.config.js` | Arranque con PM2. | Apunta a `/home/pedidos/pedidos_app`. |
| `vercel.json` | Build command y cron jobs. | Tiene un cron apuntando a una ruta inexistente. |
| `ngrok-stable-linux-amd64.zip`, `ngrok.log` | Artefactos operativos. | No son necesarios para compilar la app. |

## Dependencias externas

| Servicio | Uso en el sistema |
| --- | --- |
| Supabase Database | Tablas operativas, joins y vistas/RPC. |
| Supabase Storage | Fotos de consumo (`consumos`) y firmas (`canastillas-firmas`). |
| Supabase Auth Admin | Creacion y reseteo de usuarios desde `/admin/users`. |
| Resend | Correo de alertas criticas. |
| Vercel Cron | Ejecucion de snapshots diarios y alertas por correo. |
| PM2 | Alternativa de despliegue self-hosted. |

## Hallazgos que condicionan la lectura tecnica

- No existe una capa backend propia separada de Next.js; el backend es Supabase mas route handlers.
- Las pantallas mas importantes son `client components` y varias exportan `dynamic = "force-dynamic"`.
- El control de acceso no se implementa en el repositorio de forma explicita; depende de Supabase/RLS y del entorno de despliegue.
- Existen archivos aparentemente legacy u huerfanos: `components/pedidos/PedidoEditorClient.tsx`, un editor legado bajo `app/pedidos/` con nombre no ASCII y `lib/reservas/route.ts`.
- Los umbrales de cobertura no estan completamente centralizados entre dashboard, inventario y cron.
