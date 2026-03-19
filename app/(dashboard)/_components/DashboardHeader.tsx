"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { NotificationBell } from "@/app/(dashboard)/_components/NotificationBell";

export type DashboardHeaderProps = {
  lastUpdated: Date | null;
  isRefreshing: boolean;
  onRefresh: () => Promise<void> | void;
  notificationProps: ComponentProps<typeof NotificationBell>;
};

export function DashboardHeader({
  lastUpdated,
  isRefreshing,
  onRefresh,
  notificationProps,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-6 rounded-2xl border bg-gradient-to-r from-[#1F4F9C] via-[#1F4F9C]/90 to-[#29B8A6]/80 p-6 text-white shadow-lg lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-white/80">
          Mercamio
        </p>
        <h1 className="text-3xl font-semibold">Panel de abastecimiento</h1>
        <p className="text-sm text-white/80">
          {lastUpdated
            ? `Actualizado ${fmtDate(
                lastUpdated
              )} a las ${lastUpdated.toLocaleTimeString("es-CO", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Sincronizando datos..."}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Button
          asChild
          variant="secondary"
          className="bg-white/15 text-white hover:bg-white/25 w-full sm:w-auto"
        >
          <Link href="/inventario">Ver inventario</Link>
        </Button>
        <Button
          onClick={() => void onRefresh()}
          className="bg-white text-[#1F4F9C] hover:bg-white/90 w-full sm:w-auto"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <span className="flex items-center gap-2 text-[#1F4F9C]">
              <Loader2 className="h-4 w-4 animate-spin" /> Actualizando
            </span>
          ) : (
            "Actualizar"
          )}
        </Button>
        <div className="flex w-full justify-end sm:w-auto">
          <NotificationBell {...notificationProps} />
        </div>
      </div>
    </header>
  );
}
