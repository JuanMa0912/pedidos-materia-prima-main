import Link from "next/link";

import { Button } from "@/components/ui/button";

type InventarioHeaderProps = {
  totalMateriales: number;
  materialesCriticos: number;
  materialesEstables: number;
  loading: boolean;
  onRefresh: () => void;
};

export function InventarioHeader({
  totalMateriales,
  materialesCriticos,
  materialesEstables,
  loading,
  onRefresh,
}: InventarioHeaderProps) {
  return (
    <header className="flex flex-col gap-6 rounded-2xl border bg-gradient-to-r from-[#1F4F9C] via-[#1F4F9C]/90 to-[#29B8A6]/80 p-6 text-white shadow-lg lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-white/80">
          Inventario
        </p>
        <h1 className="text-3xl font-semibold">Inventario de materia prima</h1>
        <p className="text-sm text-white/80">
          Todas las zonas de producción
        </p>
        <div className="grid gap-4 text-xs text-white/70 sm:grid-cols-3">
          <div>
            <p className="uppercase tracking-[0.2em]">Materiales</p>
            <p className="text-xl font-semibold text-white">
              {totalMateriales || "—"}
            </p>
          </div>
          <div>
            <p className="uppercase tracking-[0.2em]">Críticos</p>
            <p className="text-xl font-semibold text-white">
              {materialesCriticos || 0}
            </p>
          </div>
          <div>
            <p className="uppercase tracking-[0.2em]">Estables</p>
            <p className="text-xl font-semibold text-white">
              {materialesEstables || 0}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          asChild
          variant="secondary"
          className="bg-white/15 text-white hover:bg-white/25"
        >
          <Link href="/">Volver al panel</Link>
        </Button>
        <Button
          asChild
          variant="secondary"
          className="bg-white/15 text-white hover:bg-white/25"
        >
          <Link href="/historial">Ver historial</Link>
        </Button>
        <Button
          variant="secondary"
          className="border-none bg-white text-primary hover:bg-white/90 hover:text-primary"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Actualizando…" : "Actualizar inventario"}
        </Button>
      </div>
    </header>
  );
}
