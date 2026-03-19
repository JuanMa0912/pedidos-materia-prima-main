"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/lib/format";
import { shouldRetryEstadoRecibido } from "@/lib/pedidos";
import { calcularFechaCobertura } from "@/lib/utils";
import { useToast } from "@/components/toastprovider";
import { Button } from "@/components/ui/button";
import { calcularConsumoDiarioKg } from "@/lib/consumo";
import type { InventarioActualRow } from "@/app/(dashboard)/_components/_types";
import {
  actualizarStockMap,
  buildNotaConStock,
  buildStockBultosMap,
  obtenerStockActual,
} from "@/lib/inventario-notas";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PedidoDetalle from "./pedidosdetalles";
import {
  getPedidosCache,
  invalidatePedidosCache,
  PEDIDOS_CACHE_TTL,
  setPedidosCache,
} from "./pedidosCache";
import { MapPin, Trash2 } from "lucide-react";

type unidadMedida = "bulto" | "unidad" | "litro" | null;

type PedidoItem = {
  material_id: string | null;
  bultos: number;
  kg: number | null;
  materiales: {
    nombre: string | null;
    unidad_medida: unidadMedida;
  } | null;
};

type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  fecha_cobertura_hasta: string | null;
  solicitante: string | null;
  estado: "enviado" | "recibido" | "completado";
  total_bultos?: number | null;
  total_kg?: number | null;
  notas?: string | null;
  pedido_items?: PedidoItem[];
};

type MovimientoItem = {
  id: string;
  material_id: string;
  bultos: number;
  kg: number | null;
  materiales: {
    unidad_medida: "bulto" | "unidad" | "litro" | null;
    presentacion_kg_por_bulto: number | null;
  } | null;
};

type PedidoItemFromSupabase = Omit<PedidoItem, "materiales"> & {
  materiales:
    | { nombre: string | null; unidad_medida: unidadMedida }
    | { nombre: string | null; unidad_medida: unidadMedida }[]
    | null;
};

const obtenerStockMap = async (zonaId: string) => {
  try {
    const response = await fetch(`/api/inventario?zonaId=${zonaId}`);

    if (!response.ok) {
      return new Map();
    }

    const payload = (await response.json()) as InventarioActualRow[];
    return buildStockBultosMap(payload);
  } catch (error) {
    console.warn("No se pudo obtener el stock actual", error);
    return new Map();
  }
};

type PedidoFromSupabase = Omit<
  Pedido,
  "pedido_items" | "fecha_cobertura_hasta"
> & {
  fecha_cobertura_hasta?: string | null;
  pedido_items: PedidoItemFromSupabase[] | null;
};

type MovimientoItemFromSupabase = Omit<MovimientoItem, "materiales"> & {
  materiales:
    | {
        unidad_medida: unidadMedida;
        presentacion_kg_por_bulto: number | null;
      }[]
    | null;
};

const ESTADO_LABELS: Record<Pedido["estado"], string> = {
  enviado: "Enviados",
  recibido: "Recibidos",
  completado: "Completados",
};

const ESTADO_HELPERS: Record<Pedido["estado"], string> = {
  enviado: "Pedidos recién solicitados",
  recibido: "Pendientes de completar",
  completado: "Ingresados al inventario",
};

export default function PedidosZona({
  zonaId,
  nombre,
}: {
  zonaId: string;
  nombre: string;
}) {
  const router = useRouter();
  const { notify } = useToast();

  const cached = getPedidosCache<Pedido[]>(zonaId);
  const [pedidos, setPedidos] = useState<Pedido[]>(cached?.data ?? []);
  const [loading, setLoading] = useState(!cached);
  const [q, setQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<Pedido["estado"] | "">("");
  const [mostrarCompletados, setMostrarCompletados] = useState(false);
  const deshaciendoPedidoRef = useRef(false);

  const resumenPorEstado = useMemo(() => {
    return pedidos.reduce<Record<Pedido["estado"], number>>(
      (acc, pedido) => {
        acc[pedido.estado] = acc[pedido.estado] + 1;
        return acc;
      },
      { enviado: 0, recibido: 0, completado: 0 },
    );
  }, [pedidos]);

  const cargarPedidos = useCallback(
    async ({ force } = { force: false }) => {
      const cache = getPedidosCache<Pedido[]>(zonaId);

      if (!force && cache) {
        setPedidos(cache.data);
        if (Date.now() - cache.fetchedAt < PEDIDOS_CACHE_TTL) {
          setLoading(false);
          return;
        }
      }

      setLoading(!cache || force);
      const [pedidosRes, inventarioRes] = await Promise.all([
        supabase
          .from("pedidos")
          .select(
            `
          id, fecha_pedido, fecha_entrega, solicitante, estado, total_bultos, total_kg, notas,        pedido_items (
          material_id,
          bultos, kg,
          materiales (nombre, unidad_medida)

        )
      `,
          )
          .eq("zona_id", zonaId)
          .order("fecha_pedido", { ascending: false }),
        fetch(`/api/inventario?zonaId=${zonaId}`)
          .then(async (response) => {
            if (!response.ok) {
              console.error(
                "Error cargando inventario para cobertura",
                response.statusText,
              );
              return [] as InventarioActualRow[];
            }

            const payload = (await response.json()) as unknown;
            return Array.isArray(payload)
              ? (payload as InventarioActualRow[])
              : [];
          })
          .catch((err) => {
            console.error("Inventario cobertura fetch error", err);
            return [] as InventarioActualRow[];
          }),
      ]);

      const { data, error } = pedidosRes;
      const inventario = inventarioRes;

      const coberturaPorMaterial = inventario.reduce<Map<string, string>>(
        (acc, item) => {
          let coberturaDias: number | null = null;

          if (item.unidad_medida === "unidad") {
            const consumo =
              typeof item.tasa_consumo_diaria_kg === "number" &&
              Number.isFinite(item.tasa_consumo_diaria_kg) &&
              item.tasa_consumo_diaria_kg > 0
                ? item.tasa_consumo_diaria_kg
                : null;

            if (consumo) {
              const diasCalculados = item.stock_bultos / consumo;
              if (Number.isFinite(diasCalculados)) {
                coberturaDias = Math.max(0, Math.floor(diasCalculados));
              }
            }
          } else {
            const consumoKg = calcularConsumoDiarioKg({
              nombre: item.nombre,
              unidad_medida: item.unidad_medida,
              presentacion_kg_por_bulto: item.presentacion_kg_por_bulto,
              tasa_consumo_diaria_kg: item.tasa_consumo_diaria_kg,
            });

            if (consumoKg && consumoKg > 0) {
              const diasCalculados = item.stock_kg / consumoKg;
              if (Number.isFinite(diasCalculados)) {
                coberturaDias = Math.max(0, Math.floor(diasCalculados));
              }
            }
          }

          if (
            coberturaDias != null &&
            Number.isFinite(coberturaDias) &&
            coberturaDias > 0 &&
            item.material_id
          ) {
            const coberturaDate = calcularFechaCobertura({
              coberturaDias,
              fechaInicio: new Date(),
            });
            acc.set(item.material_id, coberturaDate.toISOString());
          }

          return acc;
        },
        new Map<string, string>(),
      );

      if (error) {
        notify("Error cargando pedidos: " + error.message, "error");
      } else {
        const normalizados = (data ?? []).map((pedido) => {
          const pedidoTyped = pedido as PedidoFromSupabase;
          const items = pedidoTyped.pedido_items?.map((item) => {
            const itemTyped = item as PedidoItemFromSupabase;
            const materialRaw = itemTyped.materiales;
            const material = Array.isArray(materialRaw)
              ? (materialRaw[0] ?? null)
              : (materialRaw ?? null);
            return {
              ...itemTyped,
              material_id: itemTyped.material_id ?? null,

              materiales: material
                ? {
                    nombre: material.nombre ?? null,
                    unidad_medida: material.unidad_medida ?? null,
                  }
                : null,
            } satisfies PedidoItem;
          });

          const fechaCoberturaHasta = (() => {
            if (!items?.length) {
              return null;
            }

            const fechas = items
              .map((item) =>
                item.material_id
                  ? (coberturaPorMaterial.get(item.material_id) ?? null)
                  : null,
              )
              .filter((value): value is string => Boolean(value));

            if (!fechas.length) {
              return null;
            }

            return fechas.reduce((min, current) => {
              return new Date(current).getTime() < new Date(min).getTime()
                ? current
                : min;
            });
          })();

          return {
            ...pedidoTyped,
            pedido_items: items,
            fecha_cobertura_hasta: fechaCoberturaHasta ?? null,
          } satisfies Pedido;
        });

        setPedidos(normalizados);
        setPedidosCache(zonaId, normalizados);
      }
      setLoading(false);
    },
    [zonaId, notify],
  );

  useEffect(() => {
    void cargarPedidos();
  }, [cargarPedidos]);

  const deshacerUltimoPedido = useCallback(async () => {
    if (deshaciendoPedidoRef.current) return;

    deshaciendoPedidoRef.current = true;

    const confirmar = window.confirm(
      "¿Deseas deshacer el último pedido completado de esta planta?",
    );

    if (!confirmar) {
      deshaciendoPedidoRef.current = false;
      return;
    }

    try {
      const { data: ultimoMovimiento, error: ultimoError } = await supabase
        .from("movimientos_inventario")
        .select("ref_id, created_at")
        .eq("zona_id", zonaId)
        .eq("ref_tipo", "pedido")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimoError) {
        console.error(ultimoError);
        notify(
          "No pudimos buscar pedidos completados recientes. Intenta más tarde.",
          "error",
        );
        return;
      }

      const pedidoId = ultimoMovimiento?.ref_id;

      if (!pedidoId) {
        notify(
          "No hay pedidos completados para deshacer en esta planta.",
          "info",
        );
        return;
      }

      const { data: pedidoActual, error: pedidoError } = await supabase
        .from("pedidos")
        .select("id, estado")
        .eq("id", pedidoId)
        .maybeSingle();

      if (pedidoError) {
        console.error(pedidoError);
        notify(
          "No pudimos verificar el estado del pedido seleccionado.",
          "error",
        );
        return;
      }

      if (!pedidoActual || pedidoActual.estado !== "completado") {
        notify(
          "El último pedido encontrado ya no figura como completado.",
          "warning",
        );
        return;
      }

      const { data: reversionPrevia, error: reversionError } = await supabase
        .from("movimientos_inventario")
        .select("id, created_at")
        .eq("zona_id", zonaId)
        .eq("ref_tipo", "pedido_deshacer")
        .eq("ref_id", pedidoId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reversionError) {
        console.error(reversionError);
        notify(
          "No pudimos verificar si el pedido ya había sido deshecho anteriormente.",
          "error",
        );
        return;
      }

      if (reversionPrevia) {
        const fechaReversion = reversionPrevia.created_at
          ? new Date(reversionPrevia.created_at)
          : null;
        const fechaPedido = ultimoMovimiento?.created_at
          ? new Date(ultimoMovimiento.created_at)
          : null;

        if (!fechaPedido || (fechaReversion && fechaReversion >= fechaPedido)) {
          notify(
            "Este pedido ya fue deshecho anteriormente. No es posible repetir la operación.",
            "warning",
          );
          return;
        }
      }

      const { data: movimientosPedido, error: movimientosError } =
        await supabase
          .from("movimientos_inventario")
          .select("id, material_id, bultos, kg")
          .eq("zona_id", zonaId)
          .eq("ref_tipo", "pedido")
          .eq("ref_id", pedidoId)
          .returns<
            {
              id: string;
              material_id: string;
              bultos: number | null;
              kg: number | null;
            }[]
          >();

      if (movimientosError) {
        console.error(movimientosError);
        notify("Error obteniendo los movimientos del pedido.", "error");
        return;
      }

      if (!movimientosPedido?.length) {
        notify(
          "No encontramos movimientos de inventario asociados a ese pedido.",
          "warning",
        );
        return;
      }

      const fechaActual = new Date().toISOString();
      const stockMap = await obtenerStockMap(zonaId);
      const movimientosReverso = movimientosPedido.map((mov) => {
        const materialId = mov.material_id;
        const bultos = mov.bultos === null ? null : Number(mov.bultos);
        const stockActual = obtenerStockActual(stockMap, materialId);
        const notas = buildNotaConStock({
          base: "Salida automática por deshacer pedido completado",
          tipo: "salida",
          cantidad: bultos,
          stockActual,
        });
        actualizarStockMap(stockMap, materialId, "salida", bultos);

        return {
          zona_id: zonaId,
          material_id: materialId,
          fecha: fechaActual,
          tipo: "salida" as const,
          bultos,
          kg: mov.kg === null ? null : Number(mov.kg),
          ref_tipo: "pedido_deshacer",
          ref_id: pedidoId,
          notas,
        };
      });

      const { data: movimientosInsertados, error: insertError } = await supabase
        .from("movimientos_inventario")
        .insert(movimientosReverso)
        .select("id")
        .returns<{ id: string }[]>();

      if (insertError) {
        console.error(insertError);
        notify("No pudimos registrar la reversión del pedido.", "error");
        return;
      }

      let pedidoActualizadoEstado: Pedido["estado"] | null = null;
      const actualizadoRecibido = await supabase
        .from("pedidos")
        .update({ estado: "recibido", inventario_posteado: false })
        .eq("id", pedidoId)
        .select("estado")
        .maybeSingle();

      let actualizarPedidoError = actualizadoRecibido.error ?? null;

      if (!actualizarPedidoError && actualizadoRecibido.data) {
        pedidoActualizadoEstado = actualizadoRecibido.data
          .estado as Pedido["estado"];
      } else if (actualizarPedidoError) {
        if (shouldRetryEstadoRecibido(actualizarPedidoError)) {
          console.warn(
            "Fallo al devolver el pedido al estado 'recibido'. Se intentará marcar como 'enviado'.",
            actualizarPedidoError,
          );
          const actualizadoEnviado = await supabase
            .from("pedidos")
            .update({ estado: "enviado", inventario_posteado: false })
            .eq("id", pedidoId)
            .select("estado")
            .maybeSingle();

          actualizarPedidoError = actualizadoEnviado.error ?? null;
          if (!actualizarPedidoError && actualizadoEnviado.data) {
            pedidoActualizadoEstado = actualizadoEnviado.data
              .estado as Pedido["estado"];
          }
        }
      }
      if (actualizarPedidoError) {
        console.error(actualizarPedidoError);
        if (movimientosInsertados?.length) {
          await supabase
            .from("movimientos_inventario")
            .delete()
            .in(
              "id",
              movimientosInsertados.map((mov) => mov.id),
            );
        }
        notify(
          "No se pudo actualizar el pedido. Intenta nuevamente en unos minutos.",
          "error",
        );
        return;
      }

      pedidoActualizadoEstado ||= "recibido";

      const mensajeExito =
        pedidoActualizadoEstado === "enviado"
          ? "Pedido deshecho y devuelto a las lista de enviados"
          : "Pedido deshecho y devuelto a la lista de pedidos recibidos";

      notify(mensajeExito, "success");

      setPedidos((prev) => {
        const actualizados = prev.map(
          (pedido): Pedido =>
            pedido.id === pedidoId
              ? { ...pedido, estado: pedidoActualizadoEstado }
              : pedido,
        );
        setPedidosCache(zonaId, actualizados);
        return actualizados;
      });

      await cargarPedidos({ force: true });

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("pedidos:invalidate", { detail: { zonaId } }),
        );
      }
    } catch (error) {
      console.error(error);
      notify("Ocurrió un error inesperado al deshacer el pedido.", "error");
    } finally {
      deshaciendoPedidoRef.current = false;
    }
  }, [cargarPedidos, notify, zonaId]);
  const filtrados = useMemo(() => {
    return pedidos
      .filter((p) =>
        q
          ? (p.solicitante ?? "").toLowerCase().includes(q.toLowerCase())
          : true,
      )
      .filter((p) => (estadoFiltro ? p.estado === estadoFiltro : true))
      .filter((p) => (mostrarCompletados ? true : p.estado !== "completado"));
  }, [pedidos, q, estadoFiltro, mostrarCompletados]);

  async function eliminarPedido(id: string) {
    if (!confirm("¿Eliminar este pedido?")) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) {
      notify("Error al eliminar pedido: " + error.message, "error");
    } else {
      setPedidos((prev) => {
        const actualizados = prev.filter((p) => p.id !== id);
        setPedidosCache(zonaId, actualizados);
        return actualizados;
      });
      notify("Pedido eliminado ✅", "success");
    }
  }

  async function marcarCompletado(id: string) {
    const stockMap = await obtenerStockMap(zonaId);
    const { data: items, error: errItems } = await supabase
      .from("pedido_items")
      .select(
        `id, material_id, bultos, kg,
         materiales ( unidad_medida, presentacion_kg_por_bulto )`,
      )
      .eq("pedido_id", id);

    if (errItems) {
      notify("Error cargando materiales: " + errItems.message, "error");
      return;
    }

    const typedItems = (items ?? []).map((item) => {
      const itemTyped = item as MovimientoItemFromSupabase;
      return {
        ...itemTyped,
        materiales: itemTyped.materiales?.[0] ?? null,
      } satisfies MovimientoItem;
    });
    const fechaMovimiento = new Date().toISOString();
    const movimientos = typedItems.map((item) => {
      const unidad = item.materiales?.unidad_medida;
      const presentacion = item.materiales?.presentacion_kg_por_bulto;
      let kg = 0;

      if (unidad === "bulto") {
        kg = item.kg ?? (presentacion ? item.bultos * presentacion : 0);
      } else if (unidad === "litro") {
        kg = item.kg ?? item.bultos;
      } else {
        kg = item.kg ?? (presentacion ? item.bultos * presentacion : 0);
      }

      const materialId = item.material_id ?? "";
      const stockActual = materialId
        ? obtenerStockActual(stockMap, materialId)
        : null;
      const notas = buildNotaConStock({
        base: "Ingreso por pedido completado",
        tipo: "entrada",
        cantidad: item.bultos,
        stockActual,
      });
      if (materialId) {
        actualizarStockMap(stockMap, materialId, "entrada", item.bultos);
      }

      return {
        zona_id: zonaId,
        material_id: item.material_id,
        fecha: fechaMovimiento,
        tipo: "entrada",
        bultos: item.bultos,
        kg,
        ref_tipo: "pedido",
        ref_id: id,
        notas,
      };
    });

    const { error: errMov } = await supabase
      .from("movimientos_inventario")
      .insert(movimientos);

    if (errMov) {
      notify("Error registrando inventario: " + errMov.message, "error");
      return;
    }

    const { error } = await supabase
      .from("pedidos")
      .update({ estado: "completado" })
      .eq("id", id);

    if (error) {
      notify("Error al completar pedido: " + error.message, "error");
    } else {
      setPedidos((prev) => {
        const actualizados = prev.map(
          (p): Pedido => (p.id === id ? { ...p, estado: "completado" } : p),
        );
        setPedidosCache(zonaId, actualizados);
        return actualizados;
      });
      notify("Pedido completado ✅, inventario actualizado", "success");
    }
  }

  useEffect(() => {
    const handleInvalidate = (event: Event) => {
      const customEvent = event as CustomEvent<{ zonaId?: string }>;
      if (!customEvent.detail?.zonaId || customEvent.detail.zonaId === zonaId) {
        invalidatePedidosCache(customEvent.detail?.zonaId);
        void cargarPedidos({ force: true });
      }
    };

    window.addEventListener("pedidos:invalidate", handleInvalidate);
    return () => {
      window.removeEventListener("pedidos:invalidate", handleInvalidate);
    };
  }, [zonaId, cargarPedidos]);

  const badgeEstado = (estado: Pedido["estado"]) => {
    const base =
      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";
    switch (estado) {
      case "enviado":
        return (
          <span className={`${base} bg-blue-100 text-blue-700`}>Enviado</span>
        );
      case "recibido":
        return (
          <span className={`${base} bg-amber-100 text-amber-700`}>
            Recibido
          </span>
        );
      case "completado":
        return (
          <span className={`${base} bg-emerald-100 text-emerald-700`}>
            Completado
          </span>
        );
    }
  };

  const renderTotales = (pedido: Pedido) => {
    if (!pedido.pedido_items?.length) {
      return <span className="text-muted-foreground">Sin materiales</span>;
    }

    return (
      <div className="flex flex-wrap justify-center gap-2">
        {pedido.pedido_items.map((item: PedidoItem, index) => {
          const unidad = item.materiales?.unidad_medida ?? "bulto";
          const nombreMaterial =
            item.materiales?.nombre ?? "Material sin nombre";
          const cantidad = (() => {
            if (unidad === "unidad") {
              return `${fmtNum(item.bultos ?? 0)} unidades`;
            }

            if (unidad === "litro") {
              return `${fmtNum(item.bultos ?? 0)} litros`;
            }

            return `${fmtNum(item.bultos ?? 0)} bultos`;
          })();

          const extras: string[] = [];
          if (
            (unidad === "bulto" || unidad === "litro") &&
            (item.kg ?? 0) > 0
          ) {
            extras.push(`${fmtNum(item.kg ?? 0)} kg`);
          }

          const texto = [cantidad, ...extras].join(" · ");

          return (
            <span
              key={`${pedido.id}-${index}`}
              className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {`${nombreMaterial} · ${texto}`}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="gap-6 md:flex md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl">Pedidos de {nombre}</CardTitle>
            <CardDescription></CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() =>
                router.push(
                  `/pedidos/nuevo?zonaId=${zonaId}&zonaNombre=${encodeURIComponent(
                    nombre,
                  )}`,
                )
              }
            >
              Crear nuevo pedido
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {(Object.keys(resumenPorEstado) as Pedido["estado"][]).map(
              (estado) => (
                <div
                  key={estado}
                  className="rounded-xl border bg-gradient-to-br from-background via-background to-muted/60 p-4"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {ESTADO_LABELS[estado]}
                  </p>
                  <p className="mt-2 text-3xl font-semibold">
                    {fmtNum(resumenPorEstado[estado])}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {ESTADO_HELPERS[estado]}
                  </p>
                </div>
              ),
            )}
          </div>
          <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground"></p>
            <p>
              Completa el pedido cuando llegue la mercancía para actualizar el
              inventario.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Filtros Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Solicitante
              </label>
              <Input
                placeholder="Ej. Juan Pérez"
                value={q}
                onChange={(event) => setQ(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Estado
              </label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={estadoFiltro}
                onChange={(event) =>
                  setEstadoFiltro(event.target.value as Pedido["estado"] | "")
                }
              >
                <option value="">Todos los estados</option>
                <option value="enviado">Enviado</option>
                <option value="recibido">Recibido</option>
                <option value="completado">Completado</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Mostrar completados
              </label>
              <label className="flex h-10 items-center gap-3 rounded-md border border-input bg-background px-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input text-primary focus:ring-primary"
                  checked={mostrarCompletados}
                  onChange={(event) =>
                    setMostrarCompletados(event.target.checked)
                  }
                />
                Sí
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="sticky top-24 z-40 flex justify-end mr-8">
          <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#1F4F9C] via-[#1F4F9C]/90 to-[#29B8A6]/90 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-primary/20 ring-1 ring-white/30 backdrop-blur">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
              <MapPin className="h-3.5 w-3.5" />
            </span>
            <div className="flex flex-col leading-tight text-left">
              <span className="text-[10px] uppercase tracking-[0.35em] text-white/60">
                Zona actual
              </span>
              <span className="text-sm font-semibold text-white">{nombre}</span>
            </div>
          </div>
        </div>
        <CardHeader className="space-y-1">
          <CardTitle>Pedidos Enviados</CardTitle>
          <CardDescription>
            Selecciona un pedido para ver su detalle, completarlo o eliminarlo
            si fue un error.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : filtrados.length ? (
            <Table className="min-w-[800px] text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Fecha pedido</TableHead>
                  <TableHead className="text-center">Fecha entrega</TableHead>
                  <TableHead className="text-center">Cobertura hasta</TableHead>
                  <TableHead className="text-center">Solicitante</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Totales</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((pedido) => {
                  // ✅ Tipar la función correctamente
                  const formatearFecha = (
                    fecha: string | Date | undefined,
                    sumarDia = false,
                  ): string => {
                    if (!fecha) return "—";

                    const date = (() => {
                      if (fecha instanceof Date) {
                        return new Date(fecha.getTime());
                      }

                      const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;
                      const match =
                        typeof fecha === "string"
                          ? fecha.match(isoDateOnly)
                          : null;

                      if (match) {
                        const [, year, month, day] = match;
                        return new Date(
                          Number(year),
                          Number(month) - 1,
                          Number(day),
                        );
                      }

                      const parsed = new Date(fecha);
                      return Number.isNaN(parsed.getTime()) ? null : parsed;
                    })();

                    if (!date) return "—";

                    if (sumarDia) {
                      date.setDate(date.getDate());
                    }

                    return date.toLocaleDateString("es-ES");
                  };

                  return (
                    <TableRow key={pedido.id}>
                      <TableCell className="text-center">
                        {formatearFecha(pedido.fecha_pedido)}
                      </TableCell>
                      <TableCell className="text-center">
                        {pedido.fecha_entrega
                          ? formatearFecha(pedido.fecha_entrega, true) // suma 1 día
                          : "Pendiente"}
                      </TableCell>
                      <TableCell className="text-center">
                        {pedido.fecha_cobertura_hasta
                          ? formatearFecha(pedido.fecha_cobertura_hasta)
                          : "Pendiente"}
                      </TableCell>
                      <TableCell className="text-center">
                        {pedido.solicitante ?? "Sin solicitante"}
                      </TableCell>
                      <TableCell className="text-center">
                        {badgeEstado(pedido.estado)}
                      </TableCell>
                      <TableCell className="text-center">
                        {renderTotales(pedido)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-nowrap items-center justify-center gap-3">
                          <PedidoDetalle pedido={pedido} zonaNombre={nombre} />
                          <Button
                            variant="secondary"
                            className="bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
                            onClick={() =>
                              router.push(`/pedidos/${pedido.id}/editar`)
                            }
                          >
                            Editar
                          </Button>

                          {pedido.estado !== "completado" && (
                            <Button
                              className="bg-green-700 text-white h-7 border-current"
                              variant="secondary"
                              onClick={() => marcarCompletado(pedido.id)}
                            >
                              Completar
                            </Button>
                          )}

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void eliminarPedido(pedido.id)}
                            className="flex items-center gap-2 bg-rose-500 text-white shadow-sm transition hover:bg-rose-600"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="font-semibold text-foreground">
                No encontramos pedidos en esta planta
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                Usa el botón “Crear nuevo pedido” para registrar la primera
                solicitud.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
