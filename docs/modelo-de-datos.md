# Modelo de Datos y Supabase

## Alcance y fuente

Este documento describe el esquema que el codigo espera encontrar en Supabase. Como el repositorio no incluye migraciones, los campos listados se infieren desde `select`, `insert`, `update`, `rpc` y operaciones de storage realmente usadas por la aplicacion.

## Entidades principales

### `zonas`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador de zona/planta. |
| `nombre` | `string \| null` | Nombre visible de la planta. |
| `activo` | `boolean` | Filtrado de zonas habilitadas. |

### `materiales`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador del material. |
| `zona_id` | `string` | Relacion con `zonas`. |
| `nombre` | `string` | Nombre del material. |
| `presentacion_kg_por_bulto` | `number \| null` | Conversion entre bultos y kg. |
| `tasa_consumo_diaria_kg` | `number \| null` | Base de calculo de cobertura. |
| `proveedor` | `string \| null` | Dato informativo y soporte a exportes. |
| `activo` | `boolean` | Baja logica. |
| `unidad_medida` | `"bulto" \| "unidad" \| "litro"` | Semantica de cantidades. |

### `pedidos`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador del pedido. |
| `zona_id` | `string \| null` | Planta asociada. |
| `fecha_pedido` | `string` | Fecha base del pedido. |
| `fecha_entrega` | `string \| null` | Fecha estimada/comprometida. |
| `solicitante` | `string \| null` | Responsable del pedido. |
| `estado` | `"borrador" \| "enviado" \| "recibido" \| "completado"` | Estado del flujo. |
| `total_bultos` | `number \| null` | Resumen del pedido. |
| `total_kg` | `number \| null` | Resumen del pedido. |
| `notas` | `string \| null` | Observaciones generales. |
| `cancelado_at` | `string \| null` | Uso en historial para cancelados. |
| `inventario_posteado` | `boolean \| null` | Bandera usada al deshacer completados. |

### `pedido_items`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador del item. |
| `pedido_id` | `string` | Relacion con `pedidos`. |
| `material_id` | `string` | Relacion con `materiales`. |
| `bultos` | `number` | Cantidad principal. |
| `kg` | `number \| null` | Equivalente en kg. |
| `notas_item` | `string \| null` | Solo visible en editor legacy. |

### `movimientos_inventario`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador del movimiento. |
| `zona_id` | `string` | Zona afectada. |
| `material_id` | `string` | Material afectado. |
| `fecha` | `string` | Marca temporal del movimiento. |
| `tipo` | `"entrada" \| "salida"` | Direccion del movimiento. |
| `bultos` | `number \| null` | Cantidad en unidad base del material. |
| `kg` | `number \| null` | Cantidad equivalente en kg. |
| `ref_tipo` | `string \| null` | Clasificador del origen. |
| `ref_id` | `string \| null` | Referencia a pedido u otra entidad. |
| `notas` | `string \| null` | Justificacion operativa. |
| `dia_proceso` | `string \| null` | Dia asociado a consumos especiales. |
| `foto_url` | `string \| null` | Lista serializada de fotos o URL unica. |
| `created_at` | `string \| null` | Orden cronologico fino. |

#### `ref_tipo` observados

- `pedido`
- `pedido_deshacer`
- `consumo_manual_salmuera`
- `consumo_manual_agujas`
- `deshacer_consumo`
- `consumo_manual_anulado`

### `inventario_snapshots`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador tecnico. |
| `fecha` | `string` | Fecha del snapshot. |
| `bultos` | `number \| null` | Stock capturado. |
| `kg` | `number \| null` | Stock capturado. |
| `material_id` | `string` | Material del snapshot. |
| `zona_id` | `string` | Zona del snapshot. |
| `created_at` | `string \| null` | Trazabilidad. |

### `canastillas`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador del registro. |
| `consecutivo` | `string \| null` | Numero del proveedor. |
| `fecha` | `string` | Fecha del prestamo o base del registro. |
| `fecha_devolucion` | `string \| null` | Marca devoluciones. |
| `placa_vh` | `string \| null` | Vehiculo asociado. |
| `tipo_canastilla` | `string` | Grande, pequena o base. |
| `nombre_cliente` | `string \| null` | Cliente asociado. |
| `proveedor` | `string` | Proveedor de la canastilla. |
| `cantidad` | `number` | Numero de canastillas. |
| `nombre_autoriza` | `string` | Responsable que autoriza. |
| `observaciones` | `string \| null` | Texto libre. |
| `firma` | `string \| null` | `storage:<path>` o base64 historico. |
| `anulado` | `boolean \| null` | Anulacion logica. |
| `fecha_anulacion` | `string \| null` | Fecha de anulacion. |
| `motivo_anulacion` | `string \| null` | Motivo de anulacion. |

### `canastillas_proveedores`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador del proveedor. |
| `nombre` | `string` | Nombre visible. |
| `contacto` | `string \| null` | Contacto principal. |
| `telefono` | `string \| null` | Telefono. |
| `notas` | `string \| null` | Observaciones. |
| `activo` | `boolean \| null` | Baja logica. |

### `alertas_criticos_envios`

| Campo | Tipo esperado | Uso |
| --- | --- | --- |
| `id` | `string` | Identificador tecnico. |
| `fecha` | `string` | Dia del envio. |
| `total` | `number` | Numero de materiales incluidos. |
| `destinatarios` | `string[] \| json` | Correos de destino. |
| `detalle` | `json` | Lista de materiales enviados. |

### `consumo_automatico_reservas`

El archivo `lib/reservas/route.ts` asume una fuente llamada `consumo_automatico_reservas` con:

| Campo | Tipo esperado |
| --- | --- |
| `zona_id` | `string` |
| `material_id` | `string` |
| `stock_kg` | `number \| null` |
| `stock_bultos` | `number \| null` |
| `updated_at` | `string \| null` |
| `material` | Join a `materiales` |

No esta claro desde el repo si es tabla o vista.

## Relaciones de negocio

| Relacion | Tipo |
| --- | --- |
| `zonas` -> `materiales` | 1:N |
| `zonas` -> `pedidos` | 1:N |
| `pedidos` -> `pedido_items` | 1:N |
| `materiales` -> `pedido_items` | 1:N |
| `zonas` -> `movimientos_inventario` | 1:N |
| `materiales` -> `movimientos_inventario` | 1:N |
| `zonas` + `materiales` -> `inventario_snapshots` | N:N historificada |
| `canastillas_proveedores` -> `canastillas` | 1:N logico por nombre/proveedor |

## RPC requeridas

### `inventario_actual(p_zona)`

Usada por:

- `GET /api/inventario`
- cron de snapshots
- cron de alertas criticas

Campos esperados en la respuesta:

| Campo | Tipo esperado |
| --- | --- |
| `zona_id` | `string` |
| `zona_nombre` | `string \| null` |
| `material_id` | `string` |
| `nombre` | `string` |
| `unidad_medida` | `"bulto" \| "unidad" \| "litro"` |
| `presentacion_kg_por_bulto` | `number \| null` |
| `tasa_consumo_diaria_kg` | `number \| null` |
| `stock` | `number` |
| `stock_kg` | `number` |
| `stock_bultos` | `number` |

### `ajustar_stock_absoluto(p_zona, p_material, p_nuevo_stock)`

Usada por:

- `app/inventario/page.tsx`

Efecto esperado:

- generar o actualizar el movimiento necesario para dejar el stock absoluto en el valor indicado.

## Buckets de storage

| Bucket | Visibilidad | Uso |
| --- | --- | --- |
| `consumos` | Publico | Fotos de consumos manuales de inventario. |
| `canastillas-firmas` | Privado | Firmas digitales del flujo de canastillas. |

## Maquinas de estado

### Estado del pedido

```text
borrador -> enviado -> recibido -> completado
                ^         |
                |         |
                +---------+  (reversion desde inventario/pedidos)
```

Notas:

- En el flujo actual de creacion via `/api/pedidos`, los pedidos nacen en `enviado`.
- `borrador` aparece en tipos y componentes legacy, pero no en el flujo principal moderno.

### Estado del registro de canastillas

No existe un enum de estado formal. El sistema lo deriva asi:

- prestamo activo: `fecha_devolucion IS NULL` y `anulado != true`
- devolucion: `fecha_devolucion IS NOT NULL`
- anulado: `anulado = true`

## Reglas de integridad visibles en el codigo

- Un pedido no debe repetir materiales.
- Para unidad `bulto`, `kg` debe coincidir con `bultos * presentacion_kg_por_bulto`.
- Para unidad `litro`, `kg` debe coincidir con la cantidad.
- Para unidad `unidad`, `kg` debe omitirse o ser `null`.
- Las fotos de consumo se serializan como string con separador `|`.
- Las firmas nuevas de canastillas se guardan como `storage:<path>`.

## Observaciones de consistencia

- La ausencia de migraciones impide garantizar constraints reales de base de datos desde el repo.
- La tabla `alertas_criticos_envios` es tratada como opcional por el cron de alertas.
- `borrador` e `inventario_posteado` siguen apareciendo en codigo aunque el flujo principal moderno no siempre los usa.
