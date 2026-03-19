import React from "react";
import {
  CanastillaFormValues,
  EntryMode,
  InventoryItem,
} from "@/app/canastillas/types";
import { CheckCircle, Share2, RefreshCw, Download } from "lucide-react";

interface Props {
  entryMode: EntryMode;
  items: InventoryItem[];
  signature: string;
  formValues: CanastillaFormValues;
  notes: string;
  onReset: () => void;
}

export const SuccessView: React.FC<Props> = ({
  entryMode,
  items,
  signature,
  formValues,
  notes,
  onReset,
}) => {
  const totalCrates = items.reduce((acc, curr) => acc + curr.quantity, 0);
  const now = new Date().toLocaleString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const normalizedSignature = React.useMemo(() => {
    if (!signature) return "";
    if (signature.startsWith("data:")) return signature;
    if (signature.startsWith("image/")) return `data:${signature}`;
    return `data:image/png;base64,${signature}`;
  }, [signature]);

  const detailRows = [
    {
      label: entryMode === "devolucion" ? "Fecha de devolución" : "Fecha",
      value: formValues.fecha,
    },
    {
      label: "Consecutivo",
      value: formValues.consecutivo,
    },
    { label: "Placa VH", value: formValues.placaVH },
    {
      label: "Nombre cliente",
      value: formValues.nombreCliente,
    },
    {
      label: "Nombre quien autoriza",
      value: formValues.nombreAutoriza,
    },
  ];

  return (
    <div className="space-y-8 text-center animate-in zoom-in-95 duration-500">
      <div className="flex flex-col items-center print:hidden">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle size={48} />
        </div>
        <h2 className="text-2xl font-black text-slate-900">
          {entryMode === "devolucion"
            ? "¡Devolución Guardada!"
            : "¡Préstamo Guardado!"}
        </h2>
        <p className="text-slate-500 mt-1">
          El registro ha sido procesado exitosamente.
        </p>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 text-left relative overflow-hidden print:shadow-none print:border-slate-200 print:rounded-none">
        {" "}
        {/* Confetti-like accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 -translate-y-16 translate-x-16 rounded-full -z-10 opacity-50 print:hidden"></div>{" "}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Reporte #{entryMode === "devolucion" ? "DEV" : "PRE"}-
              {Math.floor(Math.random() * 90000 + 10000)}
            </h3>
            <p className="text-xs font-medium text-slate-400">{now}</p>
          </div>
          <div className="bg-blue-600 px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase">
            Completado
          </div>
        </div>
        <div className="space-y-4 mb-8">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase">
              {entryMode === "devolucion"
                ? "Datos de la devolución"
                : "Datos del préstamo"}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {detailRows.map((row) => (
                <div
                  key={row.label}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
                >
                  <p className="text-[11px] font-bold uppercase text-slate-400">
                    {row.label}
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {row.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-50">
            <span className="text-slate-600">
              {entryMode === "devolucion"
                ? "Se devolvieron"
                : "Quedaron en calidad de préstamo"}
            </span>
            <span className="text-xl font-black text-slate-900">
              {totalCrates} canastillas
            </span>
          </div>
          <div className="grid gap-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-slate-500">
                  {item.type} ({item.provider})
                </span>
                <span className="font-bold text-slate-800">
                  x{item.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">
              Observaciones
            </h4>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {notes.trim() || "Sin observaciones."}
            </div>
          </div>
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">
            Firma Digital
          </h4>
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 h-32 flex items-center justify-center">
            <img
              src={normalizedSignature}
              alt="Firma"
              className="max-h-full max-w-full grayscale contrast-125"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
        >
          <Download size={18} /> PDF
        </button>
        <button className="py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95">
          <Share2 size={18} /> Compartir
        </button>
      </div>

      <button
        onClick={onReset}
        className="w-full py-4 text-blue-600 font-bold flex items-center justify-center gap-2 hover:bg-blue-50 rounded-2xl transition-all print:hidden"
      >
        <RefreshCw size={18} /> Volver al menú
      </button>
    </div>
  );
};
