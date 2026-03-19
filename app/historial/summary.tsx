import type { Pedido } from "./types";

type HistorialSummaryProps = {
  pedidos: Pedido[];
  desde: string;
  hasta: string;
};

const cardBase =
  "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md";

function rangeDescription(desde: string, hasta: string) {
  if (desde && hasta) return `Del ${desde} al ${hasta}`;
  if (desde) return `Desde el ${desde}`;
  if (hasta) return `Hasta el ${hasta}`;
  return "Sin rango de fechas aplicado";
}

export function HistorialSummary({
  pedidos,
  desde,
  hasta,
}: HistorialSummaryProps) {
  const total = pedidos.length;
  const cancelados = pedidos.filter((pedido) =>
    Boolean(pedido.cancelado_at)
  ).length;
  const completados = pedidos.filter(
    (pedido) => pedido.estado === "completado" && !pedido.cancelado_at
  ).length;
  const enCurso = total - cancelados - completados;

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <article className={`${cardBase} col-span-2`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Pedidos filtrados
        </p>
        <p className="mt-2 text-3xl font-semibold text-slate-900">{total}</p>
        <p className="mt-1 text-sm text-slate-500">
          {rangeDescription(desde, hasta)}
        </p>
      </article>
      <article className={cardBase}>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
          Completados
        </p>
        <p className="mt-2 text-2xl font-semibold text-emerald-600">
          {completados}
        </p>
        <p className="mt-1 text-xs text-slate-500">Sin cancelados asociados.</p>
      </article>
      <article className={cardBase}>
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">
          Cancelados
        </p>
        <p className="mt-2 text-2xl font-semibold text-rose-600">
          {cancelados}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Incluye pedidos con fecha de baja.
        </p>
      </article>
      <article className={cardBase}>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
          En seguimiento
        </p>
        <p className="mt-2 text-2xl font-semibold text-amber-600">{enCurso}</p>
        <p className="mt-1 text-xs text-slate-500">
          Pedidos aún activos o en tránsito.
        </p>
      </article>
    </section>
  );
}
