# Modulos Funcionales

## 1. Dashboard principal

**Ruta:** `/`  
**Archivos clave:** `app/page.tsx`, `app/(dashboard)/_hooks/use-dashboard-data.ts`, `app/(dashboard)/_components/*`

### Responsabilidad

- Mostrar pedidos pendientes en estado `enviado`.
- Calcular un resumen de materiales por cobertura.
- Permitir completar pedidos desde el panel.

### Entradas y salidas

- Lee `pedidos` y `pedido_items`.
- Lee inventario consolidado desde `GET /api/inventario`.
- Al completar un pedido escribe en `movimientos_inventario` y actualiza `pedidos.estado = "completado"`.

### Observaciones

- Solo carga los ultimos 5 pedidos enviados.
- Usa notificaciones locales cuando aumenta el numero de materiales criticos.

## 2. Materiales

**Ruta:** `/materiales`  
**Archivo clave:** `app/materiales/page.tsx`

### Responsabilidad

- Administrar el catalogo de materiales por zona.
- Definir presentacion por bulto, consumo diario y proveedor.

### Operaciones

- Lista zonas activas y filtra a `Desposte`, `Desprese` y `Panificadora`.
- Crea y actualiza registros en `materiales`.
- Elimina logicamente materiales mediante `activo = false`.

### Reglas visibles en codigo

- Si la unidad es `bulto`, la presentacion en kg por bulto es obligatoria.
- Si la unidad es `unidad` o `litro`, la presentacion se normaliza a `1`.

## 3. Pedidos

### 3.1 Listado por zona

**Ruta:** `/pedidos`  
**Archivos clave:** `app/pedidos/page.tsx`, `app/pedidos/pedidoszonas.tsx`, `app/pedidos/pedidosCache.ts`

### Responsabilidad

- Mostrar pedidos por planta.
- Filtrar por estado, texto y visibilidad de completados.
- Permitir transiciones operativas del pedido.

### Ciclo de vida documentado en el codigo

1. **Creacion:** el pedido nace como `enviado`.
2. **Recepcion:** puede moverse a `recibido`.
3. **Completado:** al completar se insertan entradas en `movimientos_inventario`.
4. **Reversa:** puede deshacerse el ultimo pedido completado o uno asociado a un material concreto.

### Reglas tecnicas

- La cache en memoria por zona dura 2 minutos.
- El listado calcula `fecha_cobertura_hasta` combinando materiales del pedido con inventario actual.
- La reversa intenta devolver el estado a `recibido`, y si falla por restricciones, cae a `enviado`.

### 3.2 Creacion

**Ruta:** `/pedidos/nuevo`  
**Archivo clave:** `app/pedidos/nuevo/page.tsx`

### Responsabilidad

- Capturar solicitante, fecha de entrega, notas e items.
- Crear el pedido via `POST /api/pedidos`.

### Detalles operativos

- Impide materiales repetidos en el mismo pedido.
- Calcula `kg` automaticamente segun la unidad:
  - `bulto`: `bultos * presentacion`
  - `litro`: `kg = bultos`
  - `unidad`: `kg = null`

### 3.3 Edicion

**Rutas:** `/pedidos/[id]`, `/pedidos/[id]/editar`  
**Archivos clave:** `app/pedidos/[id]/page.tsx`, `app/pedidos/[id]/editar/page.tsx`

### Responsabilidad

- Editar cabecera del pedido.
- Agregar, actualizar y eliminar items.
- Cambiar manualmente el estado.

### Nota

`/pedidos/[id]/editar` es un alias que reexporta `/pedidos/[id]`.

### 3.4 Vista de lectura y exporte

**Ruta:** `/pedidos/[id]/ver`  
**Archivos clave:** `app/pedidos/[id]/ver/page.tsx`, `app/pedidos/pedidosdetalles.tsx`, `app/inventario/api/export/[id]/route.ts`

### Responsabilidad

- Mostrar el pedido en modo consulta.
- Exportar resumen como PNG o PDF.
- Generar un PDF tabular desde un route handler Node con `pdfkit`.

## 4. Inventario

**Ruta:** `/inventario`  
**Archivo clave:** `app/inventario/page.tsx`

### Responsabilidad

Es el modulo operativo mas complejo del sistema. Permite:

- consultar inventario por zona,
- ver cobertura y fecha estimada de agotamiento,
- abrir historial de movimientos,
- ajustar stock absoluto,
- registrar consumos manuales,
- adjuntar hasta 3 fotos por consumo,
- deshacer consumos manuales,
- deshacer pedidos completados que afectaron inventario,
- visualizar materiales criticos y si ya tienen pedido pendiente.

### Dependencias

- `GET /api/inventario`
- `POST /api/consumos/upload`
- `POST /api/inventario/alerta-criticos/pedidos`
- RPC `ajustar_stock_absoluto`
- tabla `movimientos_inventario`
- bucket `consumos`

### Reglas operativas importantes

- Las fotos se comprimen en cliente a maximo 0.5 MB y 1600 px.
- `ref_tipo` se usa como clasificador del movimiento:
  - `pedido`
  - `pedido_deshacer`
  - `consumo_manual_salmuera`
  - `consumo_manual_agujas`
  - `deshacer_consumo`
  - `consumo_manual_anulado`
- Para deshacer consumos se crea un movimiento compensatorio y luego se marca el original como anulado.

## 5. Historial

**Ruta:** `/historial`  
**Archivo clave:** `app/historial/page.tsx`

### Responsabilidad

- Consultar pedidos completados o cancelados.
- Filtrar por solicitante y rango de fechas.
- Agrupar la consulta por zona.

### Fuente de datos

- Tabla `pedidos`, filtrando por:
  - `estado = completado`
  - o `cancelado_at IS NOT NULL`

## 6. Consumo especial de salmuera

**Ruta:** `/Pconsumo`  
**Archivo clave:** `app/Pconsumo/page.tsx`

### Responsabilidad

- Registrar consumo manual de salmuera para `Desposte` y `Desprese`.
- Controlar dias de proceso registrados dentro de la semana actual.

### Estado real

- La pagina existe y escribe en `movimientos_inventario`.
- `middleware.ts` bloquea cualquier acceso a `/pconsumo` con HTTP `403`.
- Por lo tanto, el modulo esta implementado pero no accesible en runtime mientras no cambie el middleware.

## 7. Canastillas

### 7.1 Flujo de prestamo/devolucion

**Ruta:** `/canastillas`  
**Archivos clave:** `app/canastillas/page.tsx`, `InventoryEntry.tsx`, `SignaturePad.tsx`, `SuccessView.tsx`

### Responsabilidad

- Guiar al usuario por un flujo de varios pasos:
  1. seleccionar tipo de movimiento,
  2. registrar datos y canastillas,
  3. capturar firma,
  4. mostrar comprobante.

### Reglas

- `placaVH` debe tener 6 caracteres alfanumericos.
- `consecutivo` se fuerza a numerico.
- La firma se serializa como imagen PNG y se persiste via `POST /api/canastillas`.

### 7.2 Inventario e historial de canastillas

**Ruta:** `/canastillas/inventario`  
**Archivos clave:** `app/canastillas/inventario/page.tsx`, `app/canastillas/InventoryOverview.tsx`

### Responsabilidad

- Mostrar historial de prestamos y devoluciones.
- Filtrar por proveedor, estado y rango de fechas.
- Editar registros existentes.
- Anular registros con motivo y fecha de anulacion.
- Calcular pendientes por proveedor.

### Nota de seguridad

Las firmas se almacenan como `storage:<path>` y la vista solicita una URL firmada temporal mediante `/api/canastillas/firma`.

### 7.3 Proveedores de canastillas

**Ruta:** `/canastillas/proveedores`  
**Archivo clave:** `app/canastillas/proveedores/page.tsx`

### Responsabilidad

- Crear, editar y eliminar proveedores.
- Si el `DELETE` fisico falla, la API cae a baja logica con `activo = false`.

## 8. Administracion de usuarios

**Ruta:** `/admin/users`  
**Archivos clave:** `app/admin/users/page.tsx`, `app/api/admin/users/route.ts`

### Responsabilidad

- Listar usuarios de Supabase Auth.
- Crear usuarios.
- Restablecer contrasenas.

### Limitaciones visibles

- La pagina no tiene guardas explicitas de acceso.
- La UI ofrece selector de rol, pero el endpoint `POST /api/admin/users` solo usa `email` y `password`.

## 9. Componentes y utilidades transversales

| Elemento | Rol |
| --- | --- |
| `components/MaterialPicker.tsx` | Selector de materiales reutilizado por pedidos e inventario. |
| `components/toastprovider.tsx` | Capa simple de notificaciones para feedback operativo. |
| `lib/consumo.ts` | Normalizacion de consumo diario estimado. |
| `lib/utils.ts` | Fechas locales y calculo de cobertura sin domingos. |
| `lib/inventario-notas.ts` | Notas de auditoria con stock antes/despues. |
| `lib/pedidos.ts` | Fallback para errores al devolver estado `recibido`. |

## 10. Artefactos legacy o ambiguos

| Archivo | Situacion observada |
| --- | --- |
| `components/pedidos/PedidoEditorClient.tsx` | Editor antiguo de pedidos, sin referencias activas. |
| Archivo legado en `app/pedidos/` con nombre no ASCII | Componente experimental/legacy, sin referencias activas. |
| `lib/reservas/route.ts` | Tiene forma de route handler, pero no esta bajo `app/api`, por lo que no expone una ruta HTTP. |
