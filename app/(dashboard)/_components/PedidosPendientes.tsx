"use client";

import Link from "next/link";

import { CheckCircle2, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/Skeleton";
import { fmtDate, fmtNum } from "@/lib/format";
import { calcularFechaCobertura, cn } from "@/lib/utils";

import {
  ESTADO_LABEL,
  ESTADO_TONO,
} from "@/app/(dashboard)/_components/dashboard";
import { MaterialRow, Pedido } from "@/app/(dashboard)/_components/_types";

type PedidosPendientesProps = {
  pedidos: Pedido[];
  loading: boolean;
  error: string | null;
  hasCriticos: boolean;
  onCompletar: (id: string) => void;
  materialesConCobertura: MaterialRow[];
};

function initialsFromName(nombre: string | null) {
  if (!nombre) return "—";
  const parts = nombre.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "—";
}

export function PedidosPendientes({
  pedidos,
  loading,
  error,
  hasCriticos,
  onCompletar,
  materialesConCobertura,
}: PedidosPendientesProps) {
  return (
    <section>
      <Card className="border-slate-200 bg-white/80 shadow-lg">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl text-slate-900">
              Pedidos pendientes ({pedidos.length})
            </CardTitle>
            <CardDescription>
              Últimos movimientos listos para seguimiento y cierre.
            </CardDescription>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:auto sm:justify-end">
            <Button
              asChild
              variant="ghost"
              className="text-slate-600 hover:text-slate-900 w-full sm:w-auto"
            >
              <Link href="/pedidos">Ver todos</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-[#FF6B5A]/40 bg-[#FF6B5A]/10 p-3 text-sm text-[#B91C1C]">
              <Info className="h-4 w-4" /> {error}
            </div>
          )}
          {loading && !pedidos.length ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full bg-[#F4F6FB]" />
              ))}
            </div>
          ) : pedidos.length ? (
            <Table className="min-w-[720px] text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha pedido</TableHead>
                  <TableHead>Fecha entrega</TableHead>
                  <TableHead>Cobertura hasta</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Totales</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((p) => (
                  <TableRow
                    key={p.id}
                    className={cn(
                      "bg-white/60 transition hover:shadow-sm",
                      "border-l-4",
                      hasCriticos
                        ? "border-l-[#FF6B5A]/70"
                        : "border-l-[#1F4F9C]/40"
                    )}
                  >
                    <TableCell>{fmtDate(p.fecha_pedido)}</TableCell>
                    <TableCell>
                      {p.fecha_entrega
                        ? fmtDate(
                            new Date(
                              new Date(p.fecha_entrega).setDate(
                                new Date(p.fecha_entrega).getDate() + 1
                              )
                            )
                          )
                        : "Sin fecha"}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const items = p.pedido_items ?? [];
                        const materialPrincipal =
                          items.find((item) => item.material_id) ?? items[0];

                        if (!materialPrincipal) {
                          return "—";
                        }

                        const coberturaMaterial = materialPrincipal.material_id
                          ? materialesConCobertura.find(
                              (m) => m.id === materialPrincipal.material_id
                            )
                          : null;

                        const coberturaDias =
                          coberturaMaterial?.cobertura ?? null;

                        if (coberturaDias == null) {
                          return "Sin datos";
                        }

                        if (
                          !Number.isFinite(coberturaDias) ||
                          coberturaDias <= 0
                        ) {
                          return "Sin cobertura";
                        }

                        const coberturaDate = calcularFechaCobertura({
                          coberturaDias,
                          fechaInicio: new Date(),
                        });

                        return fmtDate(coberturaDate);
                      })()}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1F4F9C]/40 bg-[#1F4F9C]/10 text-sm font-semibold text-[#1F4F9C]">
                          {initialsFromName(p.solicitante ?? "")}
                        </span>
                        <span className="text-sm text-slate-700">
                          {p.solicitante ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      <div className="flex flex-col gap-1">
                        <span>
                          {fmtNum(p.total_bultos ?? 0)} b /{" "}
                          {fmtNum(p.total_kg ?? 0)} kg
                        </span>
                        {(() => {
                          const items = p.pedido_items ?? [];
                          if (!items.length) {
                            return null;
                          }

                          const materialPrincipal =
                            items.find((item) => item.material_nombre) ??
                            items[0];

                          const restantes = items.length - 1;
                          const baseNombre =
                            materialPrincipal?.material_nombre ??
                            "Material sin nombre";

                          const zonasMaterial = materialPrincipal?.material_id
                            ? materialesConCobertura.find(
                                (m) => m.id === materialPrincipal.material_id
                              )?.zonas ?? []
                            : [];

                          const zonasLabel = zonasMaterial.length
                            ? ` (${zonasMaterial.join(", ")})`
                            : "";

                          const labelBase = `${baseNombre}${zonasLabel}`;

                          const label =
                            restantes > 0
                              ? `${labelBase} +${restantes} más`
                              : labelBase;

                          return (
                            <span className="text-xs text-slate-500">
                              {label}
                            </span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                          ESTADO_TONO[p.estado]
                        )}
                      >
                        {ESTADO_LABEL[p.estado]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          asChild
                          variant="outline"
                          className="border-[#1F4F9C]/30 text-[#1F4F9C] hover:bg-[#1F4F9C]/10"
                        >
                          <Link href={`/pedidos/${p.id}/ver`}>Ver</Link>
                        </Button>
                        <Button
                          className="bg-[#29B8A6] text-white hover:bg-[#29B8A6]/90"
                          onClick={() => onCompletar(p.id)}
                        >
                          Completar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#1F4F9C]/20 bg-[#F4F6FB] p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-[#29B8A6]" />
              <p className="text-sm text-slate-600">
                No hay pedidos pendientes en este momento.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
