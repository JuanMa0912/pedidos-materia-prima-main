"use client";
export const dynamic = "force-dynamic";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterPanel } from "./components/filter-panel";
import { FilterSummary } from "./components/filter-summary";
import { HistorialEmptyState } from "./components/empty-state";
import { HistorialLoading } from "./components/loading-placeholder";
import { HistorialSummary } from "./summary";
import { PedidosTable } from "./components/pedidos-table";
import { Pedido } from "./types";
import { PageContainer } from "@/components/PageContainer";

type Zona = {
  id: string;
  nombre: string;
};

type PedidoSupabase = Omit<Pedido, "zonas" | "pedido_items"> & {
  zonas: { nombre: string | null }[] | { nombre: string | null } | null;
  pedido_items:
    | {
        bultos: number | null;
        kg: number | null;
        materiales:
          | {
              nombre: string;
              unidad_medida: "bulto" | "unidad" | "litro";
            }[]
          | {
              nombre: string;
              unidad_medida: "bulto" | "unidad" | "litro";
            }
          | null;
      }[]
    | null;
};

export default function HistorialPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [loading, setLoading] = useState(true);

  // filtros
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);

      const pedidosRes = await supabase
        .from("pedidos")
        .select(
          `
          id,
          fecha_pedido,
          fecha_entrega,
          solicitante,
          estado,
          total_bultos,
          total_kg,
          cancelado_at,
          zona_id,
          zonas (nombre),
          pedido_items (
            bultos,
            kg,
            materiales (nombre, unidad_medida)
          )
        `,
        )
        .or("estado.eq.completado,cancelado_at.not.is.null")
        .order("fecha_pedido", { ascending: false });

      const zonasRes = await supabase
        .from("zonas")
        .select("id, nombre")
        .eq("activo", true);

      if (pedidosRes.error) {
        console.error("Error cargando historial:", pedidosRes.error);
      } else {
        const pedidosData = (pedidosRes.data ?? []) as PedidoSupabase[];
        const pedidosLimpios: Pedido[] = pedidosData.map((pedido) => ({
          ...pedido,
          zona_id: pedido.zona_id ? String(pedido.zona_id) : null,

          zonas: Array.isArray(pedido.zonas)
            ? { nombre: pedido.zonas[0]?.nombre ?? null }
            : (pedido.zonas ?? { nombre: null }),
          pedido_items: Array.isArray(pedido.pedido_items)
            ? pedido.pedido_items
                .filter((item): item is NonNullable<typeof item> =>
                  Boolean(item),
                )
                .map((item) => ({
                  bultos: item.bultos,
                  kg: item.kg,
                  materiales: Array.isArray(item.materiales)
                    ? (item.materiales[0] ?? null)
                    : (item.materiales ?? null),
                }))
            : [],
        }));

        setPedidos(pedidosLimpios);
      }

      if (zonasRes.error) {
        console.error("Error cargando zonas:", zonasRes.error);
      } else {
        const zonasOrdenadas = (zonasRes.data ?? [])
          .filter((zona) => zona.nombre !== "Inventario General")
          .sort((a, b) => {
            const ordenPreferido = ["Desposte", "Desprese", "Panificadora"];
            const aIndex = ordenPreferido.indexOf(a.nombre);
            const bIndex = ordenPreferido.indexOf(b.nombre);
            return (
              (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
              (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
            );
          });

        setZonas(
          zonasOrdenadas.map((zona) => ({
            ...zona,
            id: String(zona.id),
          })),
        );
      }

      setLoading(false);
    }

    void cargarDatos();
  }, []);

  useEffect(() => {
    if (!zonas.length) {
      setActiveTab("");
      return;
    }

    setActiveTab((prev) => {
      if (prev && zonas.some((zona) => zona.id === prev)) {
        return prev;
      }
      return zonas[0].id;
    });
  }, [zonas]);

  const filtrados = useMemo(() => {
    return pedidos
      .filter((pedido) =>
        q
          ? (pedido.solicitante ?? "").toLowerCase().includes(q.toLowerCase())
          : true,
      )
      .filter((pedido) =>
        desde ? new Date(pedido.fecha_pedido) >= new Date(desde) : true,
      )
      .filter((pedido) =>
        hasta ? new Date(pedido.fecha_pedido) <= new Date(hasta) : true,
      );
  }, [pedidos, q, desde, hasta]);

  const rangoActivo = useMemo(() => {
    const format = (value: string) =>
      new Date(value + "T00:00:00").toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

    if (desde && hasta) {
      return `Del ${format(desde)} al ${format(hasta)}`;
    }

    if (desde) {
      return `Desde ${format(desde)}`;
    }

    if (hasta) {
      return `Hasta ${format(hasta)}`;
    }

    return "Sin rango de fechas";
  }, [desde, hasta]);

  const filtrosActivos = [
    q
      ? {
          label: "Solicitante",
          value: q,
          onRemove: () => setQ(""),
        }
      : null,
    desde
      ? {
          label: "Desde",
          value: desde,
          onRemove: () => setDesde(""),
        }
      : null,
    hasta
      ? {
          label: "Hasta",
          value: hasta,
          onRemove: () => setHasta(""),
        }
      : null,
  ].filter(Boolean) as {
    label: string;
    value: string;
    onRemove: () => void;
  }[];

  const currentTab = activeTab || (zonas.length ? zonas[0].id : "");

  function aplicarRango(desdeValue: string, hastaValue: string) {
    setDesde(desdeValue);
    setHasta(hastaValue);
  }

  return (
    <PageContainer>
      <section className="flex flex-col gap-6 rounded-2xl border bg-gradient-to-r from-[#1F4F9C] via-[#1F4F9C]/90 to-[#29B8A6]/80 p-6 text-white shadow-lg lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-white/80">
            Historial
          </p>
          <h1 className="text-3xl font-semibold">Historial de pedidos</h1>
          <p className="text-sm text-white/80">
            Consulta el histórico por zona y obtén contexto del estado actual.
          </p>
        </div>
        <dl className="grid gap-4 text-sm text-white/80 sm:grid-cols-3 lg:text-right">
          <div className="space-y-1">
            <dt className="text-xs uppercase tracking-[0.2em] text-white/60">
              Zonas activas
            </dt>
            <dd className="text-2xl font-semibold text-white">
              {zonas.length}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs uppercase tracking-[0.2em] text-white/60">
              Pedidos filtrados
            </dt>
            <dd className="text-2xl font-semibold text-white">
              {filtrados.length}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs uppercase tracking-[0.2em] text-white/60">
              Rango seleccionado
            </dt>
            <dd className="text-sm font-medium text-white/90">{rangoActivo}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4">
        <FilterPanel
          q={q}
          desde={desde}
          hasta={hasta}
          onChangeQ={setQ}
          onChangeDesde={setDesde}
          onChangeHasta={setHasta}
          onApplyRange={aplicarRango}
        />

        <FilterSummary
          filters={filtrosActivos}
          onClearAll={() => {
            setQ("");
            setDesde("");
            setHasta("");
          }}
        />
      </section>

      {loading ? (
        <HistorialLoading />
      ) : zonas.length ? (
        <section className="space-y-6">
          <HistorialSummary pedidos={filtrados} desde={desde} hasta={hasta} />

          <Tabs
            value={currentTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList className="flex w-full flex-initial justify-start gap-1.5 rounded-xl bg-muted/95 p-7 px-1 text">
              {" "}
              {zonas.map((zona) => (
                <TabsTrigger
                  key={zona.id}
                  value={zona.id}
                  className="rounded-lg border border-b-transparent px-10 py-6 text-md font-sem data-[state=active]:border-b-[#3e74cc] data-[state=active]:bg-white data-[state=active]:text-[#1F4F9C]"
                >
                  {zona.nombre}
                </TabsTrigger>
              ))}
            </TabsList>

            {zonas.map((zona) => {
              const pedidosZona = filtrados.filter((pedido) => {
                if (!pedido.zona_id) {
                  return false;
                }

                return String(pedido.zona_id) === zona.id;
              });

              return (
                <TabsContent
                  key={zona.id}
                  value={zona.id}
                  className="space-y-6"
                >
                  {pedidosZona.length ? (
                    <PedidosTable pedidos={pedidosZona} />
                  ) : (
                    <HistorialEmptyState
                      title="No hay pedidos para esta zona"
                      description="Prueba ajustando los filtros o consulta otro periodo para ver pedidos registrados."
                    />
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </section>
      ) : (
        <HistorialEmptyState
          title="Todavía no hay zonas activas"
          description="Cuando registres pedidos en una zona activa aparecerán aquí para su seguimiento."
          showAction
        />
      )}
    </PageContainer>
  );
}
