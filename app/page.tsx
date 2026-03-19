"use client";
export const dynamic = "force-dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toastprovider";
import { agruparCobertura, type CoberturaResumen } from "@/lib/cobertura";
import { DashboardHeader } from "@/app/(dashboard)/_components/DashboardHeader";
import { InventorySummary } from "@/app/(dashboard)/_components/InventorySummary";
import { PedidosPendientes } from "@/app/(dashboard)/_components/PedidosPendientes";
import { useDashboardData } from "@/app/(dashboard)/_hooks/use-dashboard-data";
import { MaterialRow } from "@/app/(dashboard)/_components/_types";
import { PageContainer } from "@/components/PageContainer";

export default function HomePage() {
  const { notify } = useToast();
  const {
    pedidos,
    pedidosLoading,
    pedidosError,
    inventarioLoading,
    inventarioError,
    materialesConCobertura,
    lastUpdated,
    cargarDashboard,
    marcarCompletado,
  } = useDashboardData({ notify });

  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevCriticos = useRef(0);
  const hasMounted = useRef(false);

  useEffect(() => {
    void cargarDashboard();
  }, [cargarDashboard]);

  const resumenCobertura = useMemo<CoberturaResumen<MaterialRow>>(() => {
    return agruparCobertura<MaterialRow>(
      materialesConCobertura.map((m) => ({
        cobertura: m.cobertura,
        payload: m,
      }))
    );
  }, [materialesConCobertura]);

  const criticosLength = resumenCobertura.critico.length;
  const alertaLength = resumenCobertura.alerta.length;

  useEffect(() => {
    const totalAlertas = criticosLength + alertaLength;
    setUnreadCount(totalAlertas);

    if (hasMounted.current && criticosLength > prevCriticos.current) {
      notify("Se detectaron nuevos materiales en nivel crítico", "warning");
    }
    prevCriticos.current = criticosLength;
    hasMounted.current = true;
  }, [alertaLength, criticosLength, notify]);

  const criticos = resumenCobertura.critico
    .map((item) => item.payload)
    .filter(Boolean) as MaterialRow[];
  const alerta = resumenCobertura.alerta
    .map((item) => item.payload)
    .filter(Boolean) as MaterialRow[];
  const seguros = resumenCobertura.seguro
    .map((item) => item.payload)
    .filter(Boolean) as MaterialRow[];

  const handleNotificationsChange = (open: boolean) => {
    setNotifOpen(open);
    if (open) {
      setUnreadCount(0);
    }
  };

  const resumenCards = useMemo(
    () => [
      {
        key: "critico" as const,
        value: criticos.length,
        gradient: "from-[#FF6B5A]/90 via-[#FF6B5A]/70 to-[#FF6B5A]/30",
        materials: criticos,
      },
      {
        key: "alerta" as const,
        value: alerta.length,
        gradient: "from-[#F5A623]/90 via-[#F5A623]/70 to-[#F5A623]/30",
        materials: alerta,
      },
      {
        key: "seguro" as const,
        value: seguros.length,
        gradient: "from-[#29B8A6]/90 via-[#29B8A6]/70 to-[#1F4F9C]/35",
        materials: seguros,
      },
    ],
    [alerta, criticos, seguros]
  );

  const handleCompletar = (id: string) => {
    void marcarCompletado(id);
  };

  return (
    <PageContainer>
      <DashboardHeader
        lastUpdated={lastUpdated}
        isRefreshing={pedidosLoading || inventarioLoading}
        onRefresh={cargarDashboard}
        notificationProps={{
          unreadCount,
          isOpen: notifOpen,
          onOpenChange: handleNotificationsChange,
          criticos,
          alerta,
          seguros,
        }}
      />

      <InventorySummary
        cards={resumenCards}
        isUpdating={inventarioLoading || pedidosLoading}
        isLoadingInventory={inventarioLoading}
        hasMateriales={materialesConCobertura.length > 0}
        error={inventarioError}
      />

      <PedidosPendientes
        pedidos={pedidos}
        loading={pedidosLoading}
        error={pedidosError}
        hasCriticos={criticos.length > 0}
        onCompletar={handleCompletar}
        materialesConCobertura={materialesConCobertura}
      />

      <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-500 sm:text-sm">
        Created by Juan Felipe Gomez and Juan Manuel Velasquez
      </footer>
    </PageContainer>
  );
}
