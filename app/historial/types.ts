export type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: "borrador" | "enviado" | "recibido" | "completado";
  total_bultos?: number | null;
  total_kg?: number | null;
  cancelado_at?: string | null;
  zona_id: string | null;
  zonas?: {
    nombre: string | null;
  } | null;
  pedido_items?: {
    bultos: number | null;
    kg: number | null;
    materiales: {
      nombre: string;
      unidad_medida: "bulto" | "unidad" | "litro";
    } | null;
  }[];
};
