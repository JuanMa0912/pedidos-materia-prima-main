"use client";
export const dynamic = "force-dynamic";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import MaterialPicker from "@/components/MaterialPicker";
import { PageContainer } from "@/components/PageContainer";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/components/toastprovider";
import { supabase } from "@/lib/supabase";
import { invalidatePedidosCache } from "../pedidosCache";

type UnidadMedida = "bulto" | "unidad" | "litro";

type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: "enviado" | "recibido" | "completado";
  total_bultos?: number | null;
  total_kg?: number | null;
  notas?: string | null;
  zona_id: string;
  zonas?: { nombre: string } | { nombre: string }[] | null;
};

type PedidoItem = {
  id: string;
  material_id: string;
  bultos: number;
  kg: number | null;
  materiales: {
    nombre: string;
    presentacion_kg_por_bulto: number | null;
    unidad_medida: UnidadMedida;
  } | null;
};

type PedidoItemQueryResult = Omit<PedidoItem, "materiales"> & {
  materiales: PedidoItem["materiales"] | PedidoItem["materiales"][] | null;
};

const ESTADO_LABEL: Record<Pedido["estado"], string> = {
  enviado: "Enviado",
  recibido: "Recibido",
  completado: "Completado",
};

const ESTADO_HELPER: Record<Pedido["estado"], string> = {
  enviado: "Pedido en preparación",
  recibido: "Material recibido, pendiente de completar",
  completado: "Pedido ingresado al inventario",
};

const parseDateValue = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateForInput = (value: string | null) => {
  if (!value) return "";
  const parsed = parseDateValue(value);
  if (!parsed) return value;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value: string | null) => {
  if (!value) return "Sin fecha";
  const parsed = parseDateValue(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat("es-CL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed);
};

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

export default function PedidoEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const pedidoId = params?.id;
  const { notify } = useToast();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [items, setItems] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pedidoId) return;
    const fetchData = async () => {
      const [
        { data: pedidoData, error: pedidoError },
        { data: itemsData, error: itemsError },
      ] = await Promise.all([
        supabase
          .from("pedidos")
          .select(
            `id, fecha_pedido, fecha_entrega, solicitante, estado, total_bultos, total_kg, notas, zona_id,
             zonas ( nombre )`
          )
          .eq("id", pedidoId)
          .maybeSingle(),
        supabase
          .from("pedido_items")
          .select(
            `id, material_id, bultos, kg,
             materiales ( nombre, presentacion_kg_por_bulto, unidad_medida )`
          )
          .eq("pedido_id", pedidoId),
      ]);

      if (pedidoError) {
        notify("No pudimos cargar el pedido solicitado", "error");
        setLoading(false);
        return;
      }

      if (itemsError) {
        notify("Error cargando los materiales del pedido", "error");
      }

      if (pedidoData) {
        setPedido(pedidoData as Pedido);
      }
      const normalizados: PedidoItem[] = (
        (itemsData ?? []) as PedidoItemQueryResult[]
      ).map((item) => {
        const material = Array.isArray(item.materiales)
          ? item.materiales[0] ?? null
          : item.materiales ?? null;
        return {
          ...item,
          materiales: material,
        } satisfies PedidoItem;
      });

      setItems(normalizados);

      setLoading(false);
    };

    void fetchData();
  }, [pedidoId, notify]);

  const resumen = useMemo(() => {
    const totalBultos = items.reduce(
      (sum, it) => sum + (Number.isFinite(it.bultos) ? it.bultos : 0),
      0
    );
    const totalKg = items.reduce(
      (sum, it) => sum + (Number.isFinite(it.kg ?? 0) ? it.kg ?? 0 : 0),
      0
    );
    return {
      totalBultos,
      totalKg,
    };
  }, [items]);

  const zonaNombre = (() => {
    if (!pedido?.zonas) return null;
    return Array.isArray(pedido.zonas)
      ? pedido.zonas[0]?.nombre ?? null
      : pedido.zonas?.nombre ?? null;
  })();

  const handleGuardar = async () => {
    if (!pedido) return;
    setSaving(true);

    const payload = {
      solicitante: pedido.solicitante,
      fecha_entrega:
        pedido.fecha_entrega && pedido.fecha_entrega !== ""
          ? pedido.fecha_entrega
          : null,
      notas: pedido.notas,
      estado: pedido.estado,
      total_bultos: resumen.totalBultos,
      total_kg: resumen.totalKg,
    };

    const { error } = await supabase
      .from("pedidos")
      .update(payload)
      .eq("id", pedido.id);

    setSaving(false);

    if (error) {
      notify("Error al guardar: " + error.message, "error");
      return;
    }

    invalidatePedidosCache(pedido.zona_id);
    notify("Pedido actualizado ✅", "success");
    router.push(
      pedido.zona_id
        ? `/pedidos?zonaId=${encodeURIComponent(pedido.zona_id)}`
        : "/pedidos"
    );
    router.refresh();
  };

  const agregarMaterial = async (
    id: string,
    meta?: {
      nombre: string;
      presentacion_kg_por_bulto: number | null;
      unidad_medida: UnidadMedida;
    }
  ) => {
    if (!pedidoId || !meta) return;
    const nuevo = {
      pedido_id: pedidoId,
      material_id: id,
      bultos: 1,
      kg:
        meta.unidad_medida === "bulto"
          ? meta.presentacion_kg_por_bulto
          : meta.unidad_medida === "litro"
          ? 1
          : null,
    };

    const { data, error } = await supabase

      .from("pedido_items")
      .insert(nuevo)
      .select(
        `id, material_id, bultos, kg,
         materiales ( nombre, presentacion_kg_por_bulto, unidad_medida )`
      )
      .maybeSingle();

    if (error) {
      notify("No pudimos agregar el material al pedido", "error");
      return;
    }

    if (data) {
      const material = Array.isArray(data.materiales)
        ? data.materiales[0] ?? null
        : data.materiales ?? null;
      setItems((prev) => [
        ...prev,
        {
          ...data,
          materiales: material,
        } as PedidoItem,
      ]);
      notify("Material agregado ✅", "success");
    }
  };

  const actualizarItem = async (
    item: PedidoItem,
    cambios: { bultos?: number; kg?: number | null }
  ) => {
    const { id } = item;
    const anterior = { bultos: item.bultos, kg: item.kg };

    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...cambios } : it))
    );
    const { error } = await supabase
      .from("pedido_items")
      .update(cambios)
      .eq("id", id);

    if (error) {
      notify("No pudimos actualizar el material", "error");
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...anterior } : it))
      );
    }
  };

  const eliminarItem = async (id: string, nombre?: string | null) => {
    const mensaje = nombre
      ? `¿Seguro que deseas eliminar el material "${nombre}" del pedido?`
      : "¿Seguro que deseas eliminar este material del pedido?";

    if (!window.confirm(mensaje)) return;

    const { error } = await supabase.from("pedido_items").delete().eq("id", id);

    if (error) {
      notify("No pudimos eliminar el material", "error");
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
    notify("Material eliminado ✅", "success");
  };

  if (loading) {
    return (
      <PageContainer className="py-12">
        <Card>
          <CardHeader>
            <CardTitle>Consultando pedido</CardTitle>
            <CardDescription>
              Obteniendo la información más reciente, por favor espera…
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (!pedido) {
    return (
      <PageContainer className="py-12">
        <Card>
          <CardHeader>
            <CardTitle>Pedido no encontrado</CardTitle>
            <CardDescription>
              No pudimos ubicar el pedido solicitado. Revisa el enlace o vuelve
              al panel principal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" onClick={() => router.push("/pedidos")}>
              Volver a pedidos
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const fechaEntregaInput = formatDateForInput(pedido.fecha_entrega);

  return (
    <PageContainer className="space-y-8 py-10">
      <header className="rounded-3xl border bg-gradient-to-br from-[#1F4F9C] via-[#1F4F9C]/95 to-[#29B8A6]/85 p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-white/80">
              Editar pedido #{pedido.id.slice(0, 8)}
            </p>
            <h1 className="text-3xl font-semibold">
              {zonaNombre ? `Pedido para ${zonaNombre}` : "Editar pedido"}
            </h1>
            <p className="text-sm text-white/80">
              Ajusta la información y los materiales solicitados antes de
              guardar los cambios.
            </p>
            <dl className="grid gap-4 text-sm text-white/90 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/70">
                  Fecha de pedido
                </dt>
                <dd className="text-base font-semibold">
                  {formatDisplayDate(pedido.fecha_pedido)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/70">
                  Fecha estimada
                </dt>
                <dd className="text-base font-semibold">
                  {pedido.fecha_entrega
                    ? formatDisplayDate(pedido.fecha_entrega)
                    : "Sin definir"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/70">
                  Total de bultos
                </dt>
                <dd className="text-base font-semibold">
                  {formatNumber(pedido.total_bultos ?? resumen.totalBultos)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/70">
                  Total kg
                </dt>
                <dd className="text-base font-semibold">
                  {formatNumber(pedido.total_kg ?? resumen.totalKg)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-col items-start gap-3 text-sm">
            <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1 text-sm font-semibold text-white/95">
              {ESTADO_LABEL[pedido.estado]}
            </span>
            <div className="rounded-2xl bg-white/10 p-4 text-left text-white/90 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-white/70">
                Resumen rápido
              </p>
              <p className="text-lg font-semibold">
                {resumen.totalBultos} bultos · {resumen.totalKg} kg
              </p>
            </div>
            <Button
              variant="secondary"
              className="bg-white/15 text-white hover:bg-white/25"
              onClick={() => router.back()}
            >
              Volver
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="h-full">
          <CardHeader className="gap-2 lg:flex lg:items-center lg:justify-between">
            <div>
              <CardTitle>Materiales solicitados</CardTitle>
              <CardDescription>
                Modifica cantidades, elimina materiales o agrega nuevos ítems.
              </CardDescription>
            </div>
            <MaterialPicker
              zonaId={pedido.zona_id}
              onChange={agregarMaterial}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-center">Unidad</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-center">Kg</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const unidad = item.materiales?.unidad_medida ?? "bulto";
                    const puedeEditarKg = unidad !== "unidad";
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.materiales?.nombre ?? "—"}
                        </TableCell>
                        <TableCell className="text-center capitalize">
                          {unidad}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={0}
                            value={item.bultos}
                            onChange={(event) => {
                              const valor = Number.parseInt(
                                event.target.value,
                                10
                              );
                              const nuevoBultos = Number.isNaN(valor)
                                ? 0
                                : Math.max(0, valor);
                              let nuevoKg = item.kg;
                              if (unidad === "bulto") {
                                const factor =
                                  item.materiales?.presentacion_kg_por_bulto ??
                                  0;
                                nuevoKg = factor
                                  ? Number((nuevoBultos * factor).toFixed(2))
                                  : 0;
                              }
                              void actualizarItem(item, {
                                bultos: nuevoBultos,
                                kg: puedeEditarKg ? nuevoKg : null,
                              });
                            }}
                            className="mx-auto w-24 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {puedeEditarKg ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={item.kg ?? 0}
                              onChange={(event) => {
                                const valor = Number.parseFloat(
                                  event.target.value
                                );
                                const nuevoKg = Number.isNaN(valor)
                                  ? 0
                                  : Math.max(0, valor);
                                void actualizarItem(item, {
                                  kg: nuevoKg,
                                });
                              }}
                              className="mx-auto w-28 text-center"
                            />
                          ) : (
                            <span>—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:text-rose-700"
                            onClick={() =>
                              eliminarItem(
                                item.id,
                                item.materiales?.nombre ?? null
                              )
                            }
                          >
                            Eliminar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay materiales asociados a este pedido todavía. Usa el
                buscador para agregar el primero.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos generales</CardTitle>
              <CardDescription>
                Actualiza la información del pedido.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Solicitante
                </label>
                <Input
                  placeholder="Nombre del solicitante"
                  value={pedido.solicitante ?? ""}
                  onChange={(event) =>
                    setPedido((prev) =>
                      prev ? { ...prev, solicitante: event.target.value } : prev
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Estado del pedido
                </label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={pedido.estado}
                  onChange={(event) =>
                    setPedido((prev) =>
                      prev
                        ? {
                            ...prev,
                            estado: event.target.value as Pedido["estado"],
                          }
                        : prev
                    )
                  }
                >
                  {(Object.keys(ESTADO_LABEL) as Pedido["estado"][]).map(
                    (estado) => (
                      <option key={estado} value={estado}>
                        {ESTADO_LABEL[estado]}
                      </option>
                    )
                  )}
                </select>
                <p className="text-xs text-muted-foreground">
                  {ESTADO_HELPER[pedido.estado]}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Fecha estimada de entrega
                </label>
                <Input
                  type="date"
                  value={fechaEntregaInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPedido((prev) =>
                      prev
                        ? { ...prev, fecha_entrega: value ? value : null }
                        : prev
                    );
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
              <CardDescription>
                Información adicional para logística.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={pedido.notas ?? ""}
                onChange={(event) =>
                  setPedido((prev) =>
                    prev ? { ...prev, notas: event.target.value } : prev
                  )
                }
                rows={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Agrega comentarios o instrucciones especiales para este pedido"
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() =>
            router.push(
              pedido.zona_id
                ? `/pedidos?zonaId=${encodeURIComponent(pedido.zona_id)}`
                : "/pedidos"
            )
          }
        >
          Cancelar
        </Button>
        <Button onClick={handleGuardar} disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </footer>
    </PageContainer>
  );
}
