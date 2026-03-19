export type PedidoEstado = "borrador" | "enviado" | "recibido" | "completado";

export type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: PedidoEstado;
  total_bultos?: number | null;
  total_kg?: number | null;
  pedido_items?: {
    material_id: string | null;
    material_nombre: string | null;
  }[];
};

export type MaterialRow = {
  id: string;
  nombre: string;
  cobertura: number | null;
  zonas?: string[];
};

export type MaterialConConsumo = {
  id: string;
  nombre: string;
  tasa_consumo_diaria_kg: number | null;
  unidad_medida: "bulto" | "unidad" | "litro" | null;
  presentacion_kg_por_bulto: number | null;
};

export type InventarioActualRow = {
  zona_id: string;
  zona_nombre?: string | null;

  material_id: string;
  nombre: string;
  unidad_medida: "bulto" | "unidad" | "litro";
  presentacion_kg_por_bulto: number | null;
  tasa_consumo_diaria_kg: number | null;
  stock: number;
  stock_kg: number;
  stock_bultos: number;
};
