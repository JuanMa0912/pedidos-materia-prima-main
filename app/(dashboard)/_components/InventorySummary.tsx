"use client";

import { Info, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { COBERTURA_TONO } from "@/app/(dashboard)/_components/dashboard";
import { MaterialRow } from "@/app/(dashboard)/_components/_types";

type InventoryCard = {
  key: keyof typeof COBERTURA_TONO;
  value: number;
  gradient: string;
  materials: MaterialRow[];
};

type InventorySummaryProps = {
  cards: InventoryCard[];
  isUpdating: boolean;
  isLoadingInventory: boolean;
  hasMateriales: boolean;
  error: string | null;
};

export function InventorySummary({
  cards,
  isUpdating,
  isLoadingInventory,
  hasMateriales,
  error,
}: InventorySummaryProps) {
  const formatZonas = (zonas?: string[]) => {
    if (!zonas?.length) return null;
    if (zonas.length === 1) return zonas[0];
    return zonas.join(", ");
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">
            Estado de Cobertura
          </h2>
          <p className="text-sm text-slate-500">
            Seguimiento de materiales segun dias disponibles
          </p>
        </div>
        {isUpdating && (
          <span className="flex items-center gap-2 text-xs font-medium text-[#1F4F9C]">
            <Loader2 className="h-4 w-4 animate-spin" /> Actualizando datos
          </span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ key, value, gradient, materials }) => {
          const tone = COBERTURA_TONO[key];

          return (
            <div key={String(key)} className="group relative">
              <Card
                tabIndex={0}
                className="relative overflow-hidden border-none bg-[#F4f6FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4F9C]/50"
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
                    gradient
                  )}
                />
                <CardHeader className="relative flex items-center justify-between">
                  <CardTitle className="text-2xl font-semibold text-slate-900">
                    {value}
                  </CardTitle>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                      tone.badge
                    )}
                  >
                    {tone.label}
                  </span>
                </CardHeader>
                <CardContent className="relative space-y-3">
                  {isLoadingInventory && !hasMateriales ? (
                    <Skeleton className="h-6 w-24 bg-white/40" />
                  ) : (
                    <p className="text-sm text-slate-700">{tone.description}</p>
                  )}
                </CardContent>
              </Card>
              <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-4 w-full max-w-[calc(100vw-2.5rem)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-700 opacity-0 shadow-xl transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100 sm:w-80">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Detalle de materiales
                </p>
                {materials?.length ? (
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {materials.map((material) => (
                      <li
                        key={material.id}
                        className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-slate-900">
                          {material.nombre}
                        </p>
                        <p className="text-xs text-slate-500">
                          {material.zonas?.length
                            ? `Área: ${formatZonas(material.zonas)}`
                            : "Área no especificada"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                    Sin materiales registrados en este nivel.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[#F5A623]/40 bg-[#F5A623]/10 p-3 text-sm text-[#92400E]">
          <Info className="h-4 w-4" /> {error}
        </div>
      )}
    </section>
  );
}
