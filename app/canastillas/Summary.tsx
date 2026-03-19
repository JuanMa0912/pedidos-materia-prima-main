import React from "react";
import { InventoryItem } from "@/app/canastillas/types";
import { FileText, MessageSquare } from "lucide-react";

interface Props {
  items: InventoryItem[];
  notes: string;
  onNotesChange: (val: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export const Summary: React.FC<Props> = ({
  items,
  notes,
  onNotesChange,
  onBack,
  onNext,
}) => {
  const totalCrates = items.reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <FileText size={20} className="text-blue-600" />
          Resumen de Inventario
        </h2>

        <div className="space-y-4">
          <div className="flex justify-between items-end border-b border-slate-100 pb-2">
            <span className="text-slate-500 font-medium">
              Quedaron en calidad de préstamo
            </span>
            <span className="text-3xl font-black text-slate-900">
              {totalCrates} canastillas
            </span>
          </div>

          <div className="grid gap-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm py-1">
                <span className="text-slate-700 font-medium">
                  {item.type} ({item.provider})
                </span>
                <span className="font-bold text-slate-900">
                  x{item.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <MessageSquare size={16} /> Observaciones Adicionales
          </label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Escriba aquí cualquier detalle relevante..."
            className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 h-32 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all resize-none"
          />
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-blue-800 text-sm">
          <strong>Aviso:</strong> Al proceder al siguiente paso, certifica que
          los datos ingresados son correctos y están listos para ser firmados.
        </p>
      </div>
    </div>
  );
};
