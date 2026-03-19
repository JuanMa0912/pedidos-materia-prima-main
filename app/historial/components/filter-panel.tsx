import { useMemo } from "react";
import { Button } from "@/components/ui/button";

type FilterPanelProps = {
  q: string;
  desde: string;
  hasta: string;
  onChangeQ: (value: string) => void;
  onChangeDesde: (value: string) => void;
  onChangeHasta: (value: string) => void;
  onApplyRange: (desde: string, hasta: string) => void;
};

const QUICK_RANGES = [
  { label: "Últimos 7 días", days: 7 },
  { label: "Este mes", type: "month" as const },
  { label: "Últimos 90 días", days: 90 },
];

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function FilterPanel({
  q,
  desde,
  hasta,
  onChangeQ,
  onChangeDesde,
  onChangeHasta,
  onApplyRange,
}: FilterPanelProps) {
  const quickOptions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return QUICK_RANGES.map((range) => {
      if (range.type === "month") {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          label: range.label,
          desde: formatDateInput(start),
          hasta: formatDateInput(end),
        };
      }

      const start = new Date(today);
      start.setDate(today.getDate() - (range.days ?? 0) + 1);
      return {
        label: range.label,
        desde: formatDateInput(start),
        hasta: formatDateInput(today),
      };
    });
  }, []);

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/60 p-5 shadow-sm backdrop-blur">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-slate-800">
          Filtros del historial
        </h2>
        <p className="text-sm text-slate-500">
          Refina la búsqueda por solicitante y periodo de pedido.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)_minmax(0,220px)]">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Solicitante
          <input
            type="text"
            placeholder="Ej: Juan Pérez"
            value={q}
            onChange={(event) => onChangeQ(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Desde
          <input
            type="date"
            value={desde}
            onChange={(event) => onChangeDesde(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(event) => onChangeHasta(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase text-slate-400">
          Rango rápido:
        </span>
        {quickOptions.map((option) => (
          <Button
            key={option.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onApplyRange(option.desde, option.hasta)}
            className="h-8 rounded-full border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition-colors
            hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
