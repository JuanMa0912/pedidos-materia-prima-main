"use client";

import React, { useState } from "react";
import { InventoryOverview } from "@/app/canastillas/InventoryOverview";
import { ArrowLeft } from "lucide-react";

export default function CanastillasInventarioPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 print:min-h-0 print:bg-white">
      <div className="container mx-auto max-w-6xl px-4 py-8 print:px-0 print:py-0">
        <div className="mb-6 flex flex-wrap justify-between gap-2 print:hidden">
          <a
            href="/canastillas"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Volver al registro
          </a>
          <button
            type="button"
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
          >
            Actualizar inventario
          </button>
        </div>
        <InventoryOverview refreshKey={refreshKey} />
      </div>
    </div>
  );
}
