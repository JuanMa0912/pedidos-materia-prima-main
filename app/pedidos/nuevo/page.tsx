"use client";
export const dynamic = "force-dynamic";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import MaterialPicker from "@/components/MaterialPicker";
import { DatePicker } from "@/components/ui/date-picker";
import { invalidatePedidosCache } from "@/app/pedidos/pedidosCache";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/toastprovider";
import { calcularFechaCobertura } from "@/lib/utils";

function LoadingNuevoPedido() {
  return (
    <main className="py-6">
      <PageContainer className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Nuevo pedido</CardTitle>
            <CardDescription>
              Preparando el formulario para crear un nuevo pedido...
            </CardDescription>
          </CardHeader>
        </Card>
      </PageContainer>
    </main>
  );
}

type PedidoItem = {
  material_id: string;
  nombre: string;
  bultos: number;
  kg: number | null;
  cobertura: number | null;
  materiales: {
    nombre: string;
    presentacion_kg_por_bulto: number | null;
    unidad_medida: "bulto" | "unidad" | "litro";
  } | null;
};

function NuevoPedidoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useToast();

  const zonaId = searchParams.get("zonaId");
  const zonaNombre = searchParams.get("zonaNombre");

  const [solicitante, setSolicitante] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState<Date | undefined>(undefined);
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<PedidoItem[]>([]);
  const [saving, setSaving] = useState(false);

  function agregarMaterial(
    id: string,
    meta?: {
      nombre: string;
      presentacion_kg_por_bulto: number | null;
      unidad_medida: "bulto" | "unidad" | "litro";
      cobertura: number | null;
    }
  ) {
    if (!meta) return;
    setItems((prev) => [
      ...prev,
      {
        material_id: id,
        nombre: meta.nombre,
        bultos: 1,
        kg:
          meta.unidad_medida === "bulto"
            ? meta.presentacion_kg_por_bulto || 0
            : meta.unidad_medida === "litro"
            ? 1 // si 1 litro = 1kg
            : null,
        cobertura: meta.cobertura,
        materiales: meta,
      },
    ]);
  }

  async function guardarPedido() {
    if (!zonaId) {
      notify("Error: no se detectó la zona del pedido.", "error");
      return;
    }
    if (items.length === 0) {
      notify("Debe agregar al menos un material.", "error");
      return;
    }

    if (items.some((item) => item.bultos <= 0)) {
      notify("Todos los materiales deben tener al menos 1 bulto.", "error");

      return;
    }

    const ids = new Set<string>();
    for (const item of items) {
      if (ids.has(item.material_id)) {
        notify("Hay materiales repetidos en el pedido.", "error");
        return;
      }
      ids.add(item.material_id);
    }

    setSaving(true);

    try {
      const response = await fetch("/api/pedidos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          zonaId,
          solicitante: solicitante.trim(),
          fechaEntrega: fechaEntrega
            ? fechaEntrega.toISOString().slice(0, 10)
            : "",
          notas: notas.trim(),
          items: items.map((item) => ({
            materialId: item.material_id,
            bultos: item.bultos,
            kg: item.kg,
          })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        const mensaje =
          (payload && (payload.error as string)) ||
          "No se pudo guardar el pedido";
        notify(mensaje, "error");
        return;
      }

      notify("Pedido creado ✅", "success");
      invalidatePedidosCache(zonaId);
      window.dispatchEvent(
        new CustomEvent("pedidos:invalidate", { detail: { zonaId } })
      );
      const redirecUrl = zonaId ? `/pedidos?zonaId=${zonaId}` : "/pedidos";
      router.push(redirecUrl);
    } catch (error) {
      console.error("guardarPedido", error);
      notify("Error creando pedido. Intenta nuevamente.", "error");
    } finally {
      setSaving(false);
    }
  }

  const totalBultos = items.reduce((sum, it) => sum + it.bultos, 0);
  const totalKg = items.reduce((sum, it) => sum + (it.kg ?? 0), 0);
  const formatoCobertura = (cobertura: number | null) => {
    if (cobertura == null) return "N/D";
    if (!Number.isFinite(cobertura) || cobertura <= 0) return "Sin cobertura";
    const fechaCobertura = calcularFechaCobertura({ coberturaDias: cobertura });
    return fechaCobertura.toLocaleDateString("es-CO");
  };

  return (
    <main className="py-6">
      <PageContainer className="space-y-8">
        <header className="rounded-2xl border bg-gradient-to-r from-[#1F4F9C] via-[#1F4F9C]/90 to-[#29B8A6]/80 p-8 text-white shadow-lg">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-white/80">
              Nuevo pedido
            </p>
            <h1 className="text-3xl font-semibold">
              Crear pedido de materia prima
            </h1>
            <p className="text-sm text-white/80">
              Estás generando un pedido para la planta
              <span className="ml-1 font-semibold text-white">
                {zonaNombre || "Desconocida"}
              </span>
              . Completa la información y agrega los materiales necesarios.
            </p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Datos del pedido</CardTitle>
              <CardDescription>
                Identifica quién solicita el pedido y cuándo debe entregarse.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Solicitante
                </label>
                <Input
                  value={solicitante}
                  onChange={(e) => setSolicitante(e.target.value)}
                  placeholder="Nombre de quien realiza el pedido"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Fecha de entrega
                </label>
                <DatePicker value={fechaEntrega} onChange={setFechaEntrega} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Notas
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Detalles adicionales, instrucciones o comentarios"
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle>Materiales solicitados</CardTitle>
              <CardDescription>
                Busca los materiales disponibles en la planta y define las
                cantidades.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {zonaId ? (
                <MaterialPicker zonaId={zonaId} onChange={agregarMaterial} />
              ) : (
                <p className="rounded-lg border border-dashed border-white/20 bg-muted/40 p-4 text-sm text-muted-foreground">
                  Selecciona una planta válida para cargar los materiales
                  disponibles.
                </p>
              )}

              {items.length > 0 ? (
                <div className="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead className="w-36 text-center">
                          Cobertura
                        </TableHead>
                        <TableHead className="w-32 text-center">
                          Cantidad
                        </TableHead>
                        {items.some(
                          (it) =>
                            it.materiales?.unidad_medida === "bulto" ||
                            it.materiales?.unidad_medida === "litro"
                        ) && (
                          <TableHead className="w-28 text-center">Kg</TableHead>
                        )}
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {it.nombre}
                          </TableCell>
                          <TableCell className="capitalize text-muted-foreground">
                            {it.materiales?.unidad_medida}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {formatoCobertura(it.cobertura)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={1}
                              value={it.bultos}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setItems((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? {
                                          ...p,
                                          bultos: val,
                                          kg:
                                            p.materiales?.unidad_medida ===
                                            "bulto"
                                              ? val *
                                                (p.materiales
                                                  ?.presentacion_kg_por_bulto ||
                                                  1)
                                              : p.materiales?.unidad_medida ===
                                                "litro"
                                              ? val
                                              : null,
                                        }
                                      : p
                                  )
                                );
                              }}
                              className="mx-auto w-24 text-center"
                            />
                          </TableCell>
                          {(it.materiales?.unidad_medida === "bulto" ||
                            it.materiales?.unidad_medida === "litro") && (
                            <TableCell className="text-center font-medium">
                              {it.kg ?? "—"}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const mensaje = it.nombre
                                  ? `¿Seguro que deseas eliminar el material "${it.nombre}" del pedido?`
                                  : "¿Seguro que deseas eliminar este material del pedido?";
                                if (!confirm(mensaje)) return;
                                setItems((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                );
                              }}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              Eliminar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableCaption className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        Ajusta las cantidades según lo que necesita la planta.
                      </span>
                      <span className="text-sm font-medium">
                        Total: {totalBultos} bultos
                        {items.some(
                          (it) =>
                            it.materiales?.unidad_medida === "bulto" ||
                            it.materiales?.unidad_medida === "litro"
                        )
                          ? ` · ${totalKg.toLocaleString()} kg`
                          : ""}
                      </span>
                    </TableCaption>
                  </Table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  Aún no has agregado materiales. Busca un material en el
                  buscador para incluirlo en el pedido.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <div className="flex flex-col-reverse justify-between gap-3 border-t pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            Revisa que toda la información sea correcta antes de enviar el
            pedido.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  zonaId
                    ? `/pedidos?tab=${encodeURIComponent(zonaId)}`
                    : "/pedidos"
                )
              }
            >
              Cancelar
            </Button>
            <Button
              onClick={guardarPedido}
              disabled={saving}
              className="bg-[#1F4F9C] hover:bg-[#1F4F9C]/90"
            >
              {saving ? "Guardando..." : "Guardar pedido"}
            </Button>
          </div>
        </div>
      </PageContainer>
    </main>
  );
}

export default function NuevoPedidoPage() {
  return (
    <Suspense fallback={<LoadingNuevoPedido />}>
      <NuevoPedidoPageContent />
    </Suspense>
  );
}
