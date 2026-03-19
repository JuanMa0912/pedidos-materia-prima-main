import type { Pedido } from "@/app/historial/types";

export function PedidoEstadoBadge({ pedido }: { pedido: Pedido }) {
  const base =
    "inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold";

  if (pedido.cancelado_at) {
    return (
      <span className={`${base} bg-rose-100 text-rose-700`}>Cancelado</span>
    );
  }

  if (pedido.estado === "completado") {
    return (
      <span className={`${base} bg-emerald-100 text-emerald-700`}>
        Completado
      </span>
    );
  }

  return (
    <span className={`${base} bg-slate-100 text-slate-600`}>
      {pedido.estado}
    </span>
  );
}
