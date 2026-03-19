import { fmtNum } from "@/lib/format";

import { formatUnidad, obtenerEtiquetaCobertura } from "../utils";
import type { StockRow } from "../types";

type MaterialButtonProps = {
  row: StockRow;
  onClick: () => void;
};

export function MaterialButton({ row, onClick }: MaterialButtonProps) {
  const { estilo, texto } = obtenerEtiquetaCobertura(row.cobertura);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-left transition-all hover:border-[#1F4F9C]/30 hover:bg-white hover:shadow-md active:scale-[0.98]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 group-hover:text-[#1F4F9C]">
          {row.nombre}
        </p>
        <p className="text-xs text-slate-500">
          {formatUnidad(row.stock, row.unidad)}
          {row.unidad !== "unidad" && row.stockKg > 0 && (
            <span className="ml-1 text-slate-400">
              &middot; {fmtNum(row.stockKg)} kg
            </span>
          )}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${estilo}`}
      >
        {texto}
      </span>
    </button>
  );
}
