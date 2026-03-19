"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { calcularConsumoDiarioKg } from "@/lib/consumo";
import type { InventarioActualRow } from "@/app/(dashboard)/_components/_types";

type Material = {
  id: string;
  nombre: string;
  presentacion_kg_por_bulto: number | null;
  unidad_medida: "bulto" | "unidad" | "litro";
  cobertura: number | null;
};

export default function MaterialPicker({
  zonaId,
  value,
  onChange,
}: {
  zonaId: string;
  value?: string;
  onChange: (
    id: string,
    meta?: {
      nombre: string;
      presentacion_kg_por_bulto: number | null;
      unidad_medida: "bulto" | "unidad" | "litro";
      cobertura: number | null;
    }
  ) => void;
}) {
  const [materiales, setMateriales] = useState<Material[]>([]);

  useEffect(() => {
    const fetchMateriales = async () => {
      const normalizarNumero = (valor: unknown) => {
        if (typeof valor === "number" && Number.isFinite(valor)) return valor;
        if (typeof valor === "string") {
          const num = Number(valor);
          return Number.isFinite(num) ? num : 0;
        }
        return 0;
      };

      const calcularCobertura = (item: InventarioActualRow): number | null => {
        const unidad = item.unidad_medida;
        const presentacion = item.presentacion_kg_por_bulto;
        const tasaConsumo = item.tasa_consumo_diaria_kg;

        const stockBase = normalizarNumero(item.stock);
        const stockKg = normalizarNumero(item.stock_kg);
        const stockBultos = normalizarNumero(item.stock_bultos);
        const presentacionSegura = presentacion ?? 0;

        const stockBultosDisponibles =
          unidad === "unidad"
            ? stockBultos || stockBase
            : stockBultos ||
              (presentacionSegura > 0 ? stockKg / presentacionSegura : 0);

        const stockKgDisponibles = unidad === "unidad" ? 0 : stockKg || stockBase;

        const consumoUnidades =
          unidad === "unidad" &&
          typeof tasaConsumo === "number" &&
          Number.isFinite(tasaConsumo) &&
          tasaConsumo > 0
            ? tasaConsumo
            : null;

        const consumoKg =
          unidad === "unidad"
            ? null
            : calcularConsumoDiarioKg({
                nombre: item.nombre,
                unidad_medida: unidad,
                presentacion_kg_por_bulto: presentacion,
                tasa_consumo_diaria_kg: tasaConsumo,
              });

        if (consumoUnidades && consumoUnidades > 0) {
          const dias = stockBultosDisponibles / consumoUnidades;
          return Number.isFinite(dias) ? Math.max(0, Math.floor(dias)) : null;
        }

        if (consumoKg && consumoKg > 0) {
          const dias = stockKgDisponibles / consumoKg;
          return Number.isFinite(dias) ? Math.max(0, Math.floor(dias)) : null;
        }

        return null;
      };

      const [materialesRes, inventarioRes] = await Promise.all([
        supabase
          .from("materiales")
          .select("id, nombre, presentacion_kg_por_bulto, unidad_medida")
          .eq("zona_id", zonaId)
          .eq("activo", true)
          .order("nombre"),
        fetch(`/api/inventario?zonaId=${encodeURIComponent(zonaId)}`),
      ]);

      const { data, error } = materialesRes;

      if (!error && data) {
        let coberturaById = new Map<string, number | null>();

        if (inventarioRes.ok) {
          const inventario = (await inventarioRes
            .json()
            .catch(() => [])) as InventarioActualRow[];
          coberturaById = new Map(
            inventario.map((item) => [item.material_id, calcularCobertura(item)]),
          );
        }

        const materialesConCobertura = (data as Omit<Material, "cobertura">[]).map(
          (item) => ({
            ...item,
            cobertura: coberturaById.get(item.id) ?? null,
          }),
        );

        setMateriales(materialesConCobertura);
      }
    };

    if (zonaId) fetchMateriales();
  }, [zonaId]);

  return (
    <select
      className="rounded-lg border px-3 py-1 text-sm"
      value={value ?? ""}
      onChange={(e) => {
        const mat = materiales.find((m) => m.id === e.target.value);
        onChange(
          e.target.value,
          mat
            ? {
                nombre: mat.nombre,
                presentacion_kg_por_bulto: mat.presentacion_kg_por_bulto,
                unidad_medida: mat.unidad_medida,
                cobertura: mat.cobertura,
              }
            : undefined
        );
      }}
    >
      <option value="">Seleccionar material</option>
      {materiales.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nombre}{" "}
          {m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto
            ? `(${m.presentacion_kg_por_bulto} kg/bulto)`
            : `(${m.unidad_medida})`}
        </option>
      ))}
    </select>
  );
}
