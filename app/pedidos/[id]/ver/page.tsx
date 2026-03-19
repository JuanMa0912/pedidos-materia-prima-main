"use client";
export const dynamic = "force-dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";

import { PageContainer } from "@/components/PageContainer";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/toastprovider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";

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
    unidad_medida: "bulto" | "unidad" | "litro";
  } | null;
};

export default function PedidoEditor() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const pedidoId = id;
  const { notify } = useToast();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [items, setItems] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: pedidoData, error: pedidoError } = await supabase
        .from("pedidos")
        .select(
          `id, fecha_pedido, fecha_entrega, solicitante, estado, total_bultos, total_kg, notas, zona_id,
           zonas ( nombre )`
        )
        .eq("id", pedidoId)
        .single();

      if (pedidoError) {
        notify("No pudimos cargar el pedido solicitado", "error");
        setLoading(false);
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("pedido_items")
        .select(
          `id, material_id, bultos, kg,
           materiales ( nombre, presentacion_kg_por_bulto, unidad_medida )`
        )
        .eq("pedido_id", pedidoId);

      if (pedidoData) setPedido(pedidoData);

      if (itemsError) {
        notify("Error cargando los materiales del pedido", "error");
      }

      type PedidoItemFromSupabase = Omit<PedidoItem, "materiales"> & {
        materiales:
          | PedidoItem["materiales"]
          | PedidoItem["materiales"][]
          | null;
      };

      const normalizados: PedidoItem[] = (itemsData ?? []).map((item) => {
        const itemTyped = item as PedidoItemFromSupabase;
        const materiales = Array.isArray(itemTyped.materiales)
          ? itemTyped.materiales[0] ?? null
          : itemTyped.materiales;
        return {
          ...itemTyped,
          materiales,
        } satisfies PedidoItem;
      });

      setItems(normalizados);

      setLoading(false);
    };

    if (pedidoId) void fetchData();
  }, [pedidoId, notify]);

  const resumen = useMemo(() => {
    const totalBultos = items.reduce((sum, it) => sum + it.bultos, 0);
    const totalKg = items.reduce((sum, it) => sum + (it.kg ?? 0), 0);
    return {
      totalBultos,
      totalKg,
    };
  }, [items]);

  const parseDateValue = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed;
  };

  const formatDate = (value: string | null) => {
    if (!value) return "Sin fecha";
    try {
      const parsedDate = parseDateValue(value);
      if (!parsedDate) return value;

      return new Intl.DateTimeFormat("es-CL", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }).format(parsedDate);
    } catch {
      return value;
    }
  };

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "—";
    return new Intl.NumberFormat("es-CL").format(value);
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

  const zonaNombre = Array.isArray(pedido.zonas)
    ? pedido.zonas[0]?.nombre
    : pedido.zonas?.nombre;

  const estadoClase: Record<Pedido["estado"], string> = {
    enviado: "bg-white/20 text-white",
    recibido: "bg-amber-100/90 text-amber-900",
    completado: "bg-emerald-100 text-emerald-800",
  };

  const estadoEtiqueta: Record<Pedido["estado"], string> = {
    enviado: "Enviado",
    recibido: "Recibido",
    completado: "Completado",
  };

  return (
    <PageContainer className="space-y-8 py-10">
      <header className="rounded-3xl border bg-gradient-to-br from-[#1F4F9C] via-[#1F4F9C]/95 to-[#29B8A6]/85 p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-white/80">
              Pedido #{pedido.id.slice(0, 8)}
            </p>
            <h1 className="text-3xl font-semibold">
              {zonaNombre ? `Pedido para ${zonaNombre}` : "Detalle de pedido"}
            </h1>
            <p className="text-sm text-white/80">
              Solicita, revisa y haz seguimiento de los materiales registrados.
            </p>
            <dl className="grid gap-4 text-sm text-white/90 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/70">
                  Fecha de pedido
                </dt>
                <dd className="text-base font-semibold">
                  {formatDate(pedido.fecha_pedido)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/70">
                  Fecha estimada
                </dt>
                <dd className="text-base font-semibold">
                  {formatDate(pedido.fecha_entrega)}
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
            <span
              className={`inline-flex items-center rounded-full px-4 py-1 text-sm font-semibold ${
                estadoClase[pedido.estado]
              }`}
            >
              {estadoEtiqueta[pedido.estado]}
            </span>
            <div className="rounded-2xl bg-white/10 p-4 text-left text-white/90 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-white/70">
                Solicitante
              </p>
              <p className="text-lg font-semibold">
                {pedido.solicitante || "Sin definir"}
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
          <CardHeader>
            <CardTitle>Materiales solicitados</CardTitle>
            <CardDescription>
              Detalle de cada ítem incluido en este pedido.
            </CardDescription>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">
                        {it.materiales?.nombre || "—"}
                      </TableCell>
                      <TableCell className="text-center capitalize">
                        {it.materiales?.unidad_medida ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatNumber(it.bultos)}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatNumber(it.kg)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableCaption className="flex flex-wrap items-center justify-between gap-2">
                  <span>{items.length} materiales registrados</span>
                  <span>
                    Total: {formatNumber(resumen.totalBultos)} bultos ·{" "}
                    {formatNumber(resumen.totalKg)} kg
                  </span>
                </TableCaption>
              </Table>
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay materiales asociados a este pedido.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notas del pedido</CardTitle>
              <CardDescription>
                Información adicional para el equipo logístico.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pedido.notas ? (
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {pedido.notas}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No se registraron notas para este pedido.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumen rápido</CardTitle>
              <CardDescription>Métricas esenciales del pedido.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm">
                <div className="rounded-xl bg-muted/60 p-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total de materiales
                  </dt>
                  <dd className="text-2xl font-semibold text-foreground">
                    {items.length}
                  </dd>
                </div>
                <div className="rounded-xl bg-muted/60 p-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Bultos registrados
                  </dt>
                  <dd className="text-2xl font-semibold text-foreground">
                    {formatNumber(resumen.totalBultos)}
                  </dd>
                </div>
                <div className="rounded-xl bg-muted/60 p-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Kilogramos estimados
                  </dt>
                  <dd className="text-2xl font-semibold text-foreground">
                    {formatNumber(resumen.totalKg)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>
    </PageContainer>
  );
}
