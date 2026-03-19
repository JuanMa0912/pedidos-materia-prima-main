"use client";

import { useCallback, useState } from "react";
import { toNum } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { calcularConsumoDiarioKg } from "@/lib/consumo";
import {
  actualizarStockMap,
  buildNotaConStock,
  buildStockBultosMap,
  obtenerStockActual,
} from "@/lib/inventario-notas";

import { ToastType } from "@/components/toastprovider";
import {
  MaterialRow,
  Pedido,
  InventarioActualRow,
} from "@/app/(dashboard)/_components/_types";

type UseDashboardDataArgs = {
  notify: (msg: string, type?: ToastType) => void;
};

type UseDashboardDataResult = {
  pedidos: Pedido[];
  pedidosLoading: boolean;
  pedidosError: string | null;
  inventarioLoading: boolean;
  inventarioError: string | null;
  materialesConCobertura: MaterialRow[];
  lastUpdated: Date | null;
  cargarDashboard: () => Promise<void>;
  marcarCompletado: (id: string) => Promise<void>;
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

export function useDashboardData({
  notify,
}: UseDashboardDataArgs): UseDashboardDataResult {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [materialesConCobertura, setMaterialesConCobertura] = useState<
    MaterialRow[]
  >([]);
  const [pedidosLoading, setPedidosLoading] = useState(true);
  const [inventarioLoading, setInventarioLoading] = useState(true);
  const [pedidosError, setPedidosError] = useState<string | null>(null);
  const [inventarioError, setInventarioError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const cargarPedidos = useCallback(async () => {
    setPedidosLoading(true);
    setPedidosError(null);
    const { data, error } = await supabase
      .from("pedidos")
      .select(
        `id, fecha_pedido, fecha_entrega, solicitante, estado, total_bultos, total_kg,pedido_items (
          material_id,
          materiales (nombre)
          )`,
      )
      .eq("estado", "enviado")
      .order("fecha_pedido", { ascending: false })
      .limit(5);

    if (error) {
      setPedidosError(error.message);
      notify("No pudimos cargar los pedidos pendientes", "error");
    }

    type PedidoItemFromSupabase = {
      material_id: string | null;
      materiales:
        | { nombre: string | null }
        | { nombre: string | null }[]
        | null;
    };

    type PedidoFromSupabase = Omit<Pedido, "pedido_items"> & {
      pedido_items: PedidoItemFromSupabase[] | null;
    };

    const pedidosNormalizados = (data ?? []).map((pedido) => {
      const pedidoTyped = pedido as PedidoFromSupabase;
      const items = Array.isArray(pedidoTyped.pedido_items)
        ? pedidoTyped.pedido_items.map((item) => {
            const materialRaw = item.materiales;
            const material = Array.isArray(materialRaw)
              ? (materialRaw[0] ?? null)
              : (materialRaw ?? null);

            return {
              material_id: item.material_id ?? null,
              material_nombre: material?.nombre ?? null,
            } satisfies NonNullable<Pedido["pedido_items"]>[number];
          })
        : [];

      return {
        ...pedidoTyped,
        pedido_items: items,
      } satisfies Pedido;
    });

    setPedidos(pedidosNormalizados);
    setPedidosLoading(false);
  }, [notify]);

  const cargarInventario = useCallback(async () => {
    setInventarioLoading(true);
    setInventarioError(null);

    try {
      const response = await fetch("/api/inventario");

      if (!response.ok) {
        throw new Error("No pudimos obtener el inventario");
      }

      const payload = (await response.json()) as InventarioActualRow[];

      const normalizarNumero = (valor: unknown) => {
        if (typeof valor === "number") {
          return Number.isFinite(valor) ? valor : 0;
        }

        if (typeof valor === "string") {
          return toNum(valor);
        }

        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : 0;
      };

      type MaterialAgrupado = {
        id: string;
        nombre: string;
        unidad: InventarioActualRow["unidad_medida"];
        presentacionKgPorBulto: InventarioActualRow["presentacion_kg_por_bulto"];
        tasaConsumoDiariaKg: InventarioActualRow["tasa_consumo_diaria_kg"];
        stockKg: number;
        stockBultos: number;
        zonas: Set<string>;
      };

      const materialesAgrupados = payload.reduce<Map<string, MaterialAgrupado>>(
        (acc, item) => {
          const unidad = item.unidad_medida;
          const stockBase = normalizarNumero(item.stock);
          const stockKg = normalizarNumero(item.stock_kg);
          const stockBultos = normalizarNumero(item.stock_bultos);

          const stockPorUnidad = (() => {
            if (unidad === "unidad") {
              return {
                stockKg: 0,
                stockBultos: stockBultos || stockBase,
              };
            }

            const baseKg = stockKg || stockBase;
            const baseBultos =
              unidad === "bulto" ? stockBultos || stockBase : stockBultos;

            return {
              stockKg: baseKg,
              stockBultos: baseBultos,
            };
          })();

          const existente = acc.get(item.material_id);
          const zonaNombre =
            typeof item.zona_nombre === "string" && item.zona_nombre.trim()
              ? item.zona_nombre.trim()
              : null;

          if (existente) {
            existente.stockKg += stockPorUnidad.stockKg;
            existente.stockBultos += stockPorUnidad.stockBultos;
            if (zonaNombre) {
              existente.zonas.add(zonaNombre);
            }
          } else {
            acc.set(item.material_id, {
              id: item.material_id,
              nombre: item.nombre,
              unidad,
              presentacionKgPorBulto: item.presentacion_kg_por_bulto,
              tasaConsumoDiariaKg: item.tasa_consumo_diaria_kg,
              stockKg: stockPorUnidad.stockKg,
              stockBultos: stockPorUnidad.stockBultos,
              zonas: new Set(zonaNombre ? [zonaNombre] : []),
            });
          }

          return acc;
        },
        new Map<string, MaterialAgrupado>(),
      );

      const materiales = Array.from(materialesAgrupados.values()).reduce<
        MaterialRow[]
      >((acc, item) => {
        let cobertura: number | null = null;

        if (item.unidad === "unidad") {
          const consumoUnidades =
            item.tasaConsumoDiariaKg && item.tasaConsumoDiariaKg > 0
              ? item.tasaConsumoDiariaKg
              : null;
          if (consumoUnidades) {
            const diasCalculados = item.stockBultos / consumoUnidades;
            if (Number.isFinite(diasCalculados)) {
              cobertura = Math.max(0, Math.floor(diasCalculados));
            }
          }
        } else {
          const consumoKg = calcularConsumoDiarioKg({
            nombre: item.nombre,
            unidad_medida: item.unidad,
            presentacion_kg_por_bulto: item.presentacionKgPorBulto,
            tasa_consumo_diaria_kg: item.tasaConsumoDiariaKg,
          });
          if (consumoKg) {
            const diasCalculados = item.stockKg / consumoKg;
            if (Number.isFinite(diasCalculados)) {
              cobertura = Math.max(0, Math.floor(diasCalculados));
            }
          }
        }

        if (cobertura !== null) {
          const zonas = Array.from(item.zonas).filter(
            (zona) => zona.length > 0,
          );

          acc.push({ id: item.id, nombre: item.nombre, cobertura, zonas });
        }

        return acc;
      }, []);

      setMaterialesConCobertura(materiales);
    } catch (error) {
      console.error(error);
      setInventarioError(
        error instanceof Error ? error.message : "Error inesperado",
      );
      notify("No pudimos calcular la cobertura de inventario", "error");
      setMaterialesConCobertura([]);
    } finally {
      setInventarioLoading(false);
    }
  }, [notify]);

  const cargarDashboard = useCallback(async () => {
    await Promise.all([cargarPedidos(), cargarInventario()]);
    setLastUpdated(new Date());
  }, [cargarInventario, cargarPedidos]);

  const marcarCompletado = useCallback(
    async (id: string) => {
      const pedido = pedidos.find((p) => p.id === id);
      const confirmMessage = pedido
        ? `¿Completar este pedido?`
        : "¿Completar este pedido?";
      if (typeof window !== "undefined" && !window.confirm(confirmMessage)) {
        return;
      }

      const { data: pedidoDetalle, error: pedidoDetalleError } = await supabase
        .from("pedidos")
        .select(
          `zona_id,
           pedido_items (
             material_id,
             bultos,
             kg,
             materiales (
               unidad_medida,
               presentacion_kg_por_bulto
             )
           )`,
        )
        .eq("id", id)
        .maybeSingle();

      if (pedidoDetalleError) {
        notify(
          "No pudimos obtener los detalles del pedido para completarlo.",
          "error",
        );
        return;
      }

      if (!pedidoDetalle) {
        notify("No encontramos el pedido seleccionado.", "error");
        return;
      }

      if (!pedidoDetalle.zona_id) {
        notify(
          "El pedido no tiene una planta asociada para actualizar el inventario.",
          "error",
        );
        return;
      }

      const zonaId = pedidoDetalle.zona_id as string;

      type PedidoItemDetalle = {
        material_id: string | null;
        bultos: number | null;
        kg: number | null;
        materiales:
          | {
              unidad_medida: "bulto" | "unidad" | "litro" | null;
              presentacion_kg_por_bulto: number | null;
            }
          | {
              unidad_medida: "bulto" | "unidad" | "litro" | null;
              presentacion_kg_por_bulto: number | null;
            }[]
          | null;
      };

      const items = Array.isArray(pedidoDetalle.pedido_items)
        ? pedidoDetalle.pedido_items.map((item) => {
            const itemTyped = item as PedidoItemDetalle;
            const material = Array.isArray(itemTyped.materiales)
              ? (itemTyped.materiales[0] ?? null)
              : (itemTyped.materiales ?? null);

            return {
              material_id: itemTyped.material_id,
              bultos: Number(itemTyped.bultos ?? 0),
              kg: typeof itemTyped.kg === "number" ? itemTyped.kg : null,
              materiales: material,
            };
          })
        : [];

      if (!items.length) {
        notify(
          "El pedido no tiene materiales para ingresar al inventario.",
          "error",
        );
        return;
      }

      const stockMap = await obtenerStockMap(zonaId);

      type MovimientoInventario = {
        zona_id: string;
        material_id: string | null;
        fecha: string;
        tipo: "entrada";
        bultos: number;
        kg: number;
        ref_tipo: "pedido";
        ref_id: string;
        notas: string;
      };

      const movimientos = items.map<MovimientoInventario>((item) => {
        const unidad = item.materiales?.unidad_medida ?? null;
        const presentacion = item.materiales?.presentacion_kg_por_bulto ?? null;

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
          fecha: new Date().toISOString(),
          tipo: "entrada",
          bultos: item.bultos,
          kg,
          ref_tipo: "pedido",
          ref_id: id,
          notas,
        };
      });

      type MovimientoInventarioConMaterial = MovimientoInventario & {
        material_id: string;
      };

      const movimientosValidos = movimientos.filter(
        (movimiento): movimiento is MovimientoInventarioConMaterial =>
          typeof movimiento.material_id === "string" &&
          movimiento.material_id.length > 0,
      );

      if (!movimientosValidos.length) {
        notify(
          "No pudimos determinar los materiales para actualizar el inventario.",
          "error",
        );
        return;
      }

      const inserciones = await Promise.all(
        movimientosValidos.map((movimiento) =>
          supabase.from("movimientos_inventario").insert(movimiento),
        ),
      );

      const errMov = inserciones.find(({ error }) => error)?.error;

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
        return;
      }

      setPedidos((prev) => prev.filter((p) => p.id !== id));
      await Promise.all([cargarPedidos(), cargarInventario()]);
      setLastUpdated(new Date());
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("pedidos:invalidate", {
            detail: { zonaId },
          }),
        );
      }
      notify("Pedido completado ✅, inventario actualizado", "success");
    },
    [cargarInventario, cargarPedidos, notify, pedidos],
  );

  return {
    pedidos,
    pedidosLoading,
    pedidosError,
    inventarioLoading,
    inventarioError,
    materialesConCobertura,
    lastUpdated,
    cargarDashboard,
    marcarCompletado,
  };
}
