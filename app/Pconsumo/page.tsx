"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ConsumoManualSalmueraDialog } from "@/app/inventario/_components/ConsumoManualSalmueraDialog";
import type { MaterialConsumo, Unidad } from "@/app/inventario/types";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import type { InventarioActualRow } from "@/app/(dashboard)/_components/_types";
import {
  buildNotaConStock,
  buildStockBultosMap,
  obtenerStockActual,
} from "@/lib/inventario-notas";
import { supabase } from "@/lib/supabase";

const EMPTY_CONSUMO: MaterialConsumo = { id: "", nombre: "", unidad: "bulto" };

const formatearFecha = (fecha: Date) => {
  const year = fecha.getFullYear();
  const month = `${fecha.getMonth() + 1}`.padStart(2, "0");
  const day = `${fecha.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const obtenerRangoSemanaActual = () => {
  const hoy = new Date();
  const indiceNormalizado = (hoy.getDay() + 6) % 7;
  const inicioSemana = new Date(hoy);
  inicioSemana.setHours(0, 0, 0, 0);
  inicioSemana.setDate(hoy.getDate() - indiceNormalizado);

  const finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 6);

  return {
    inicio: formatearFecha(inicioSemana),
    fin: formatearFecha(finSemana),
  };
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

type ZonaKey = "desprese" | "desposte";

type ZonaInfo = {
  id: string;
  nombre: string;
  materiales: MaterialConsumo[];
};

const REF_TIPO_CONSUMO_SALMUERA = "consumo_manual_salmuera" as const;

const ZONA_LABELS: Record<ZonaKey, string> = {
  desposte: "Desposte Salmuera",
  desprese: "Desprese Salmuera",
};

export default function PconsumoPage() {
  const [zonas, setZonas] = useState<Partial<Record<ZonaKey, ZonaInfo>>>({});
  const [selectedZonaKey, setSelectedZonaKey] = useState<ZonaKey | null>(null);
  const [materialConsumo, setMaterialConsumo] =
    useState<MaterialConsumo>(EMPTY_CONSUMO);
  const [valorConsumo, setValorConsumo] = useState("");
  const [diaProceso, setDiaProceso] = useState("");
  const [showConsumo, setShowConsumo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [diasSemanaRegistrados, setDiasSemanaRegistrados] = useState<string[]>(
    [],
  );
  const cargarDiasRegistradosSemana = useCallback(async (zonaId: string) => {
    const { inicio, fin } = obtenerRangoSemanaActual();
    const { data, error } = await supabase
      .from("movimientos_inventario")
      .select("dia_proceso")
      .eq("zona_id", zonaId)
      .eq("ref_tipo", REF_TIPO_CONSUMO_SALMUERA)
      .gte("fecha", inicio)
      .lte("fecha", fin);

    if (error) {
      console.error(
        "❌ Error obteniendo días registrados de consumo manual:",
        error,
      );
      return;
    }

    const diasRegistrados = Array.from(
      new Set(
        (data ?? [])
          .map((registro) => registro.dia_proceso)
          .filter((dia): dia is string => Boolean(dia)),
      ),
    );

    setDiasSemanaRegistrados(diasRegistrados);
  }, []);

  const cargarZonas = useCallback(async () => {
    const { data: zonasData, error: zonasError } = await supabase
      .from("zonas")
      .select("id, nombre");

    if (zonasError) {
      console.error("❌ Error obteniendo zonas para consumo:", zonasError);
      return;
    }

    const relevantes: Partial<Record<ZonaKey, ZonaInfo>> = {};

    for (const zona of zonasData ?? []) {
      const nombreNormalizado = zona.nombre.trim().toLowerCase();
      if (
        nombreNormalizado === "desposte" ||
        nombreNormalizado === "desprese"
      ) {
        const { data: materialesData, error: materialesError } = await supabase
          .from("materiales")
          .select("id, nombre, unidad_medida, activo")
          .eq("zona_id", zona.id)
          .eq("activo", true);

        if (materialesError) {
          console.error(
            "❌ Error obteniendo materiales para consumo:",
            materialesError,
          );
          continue;
        }

        const materiales = (materialesData ?? [])
          .filter(
            (material) =>
              material.activo !== false &&
              material.nombre.toLowerCase().includes("salmuera"),
          )
          .map(
            (material) =>
              ({
                id: material.id,
                nombre: material.nombre,
                unidad: material.unidad_medida as Unidad,
              }) satisfies MaterialConsumo,
          );

        relevantes[nombreNormalizado as ZonaKey] = {
          id: zona.id,
          nombre: zona.nombre,
          materiales,
        };
      }
    }

    setZonas(relevantes);
  }, []);

  useEffect(() => {
    void cargarZonas();
  }, [cargarZonas]);

  const zonaSeleccionada = useMemo(() => {
    if (!selectedZonaKey) return null;
    return zonas[selectedZonaKey] ?? null;
  }, [selectedZonaKey, zonas]);

  const abrirConsumo = (zonaKey: ZonaKey) => {
    const zona = zonas[zonaKey];
    if (!zona) {
      alert("No se encontró la zona seleccionada.");
      return;
    }

    if (!zona.materiales.length) {
      alert(
        "No hay materiales activos configurados para registrar consumo en esta zona.",
      );
      return;
    }

    setSelectedZonaKey(zonaKey);
    setMaterialConsumo(zona.materiales[0]);
    setValorConsumo("");
    setDiaProceso("");
    setDiasSemanaRegistrados([]);
    void cargarDiasRegistradosSemana(zona.id);
    setShowConsumo(true);
  };

  const guardarConsumoManual = useCallback(async () => {
    if (!zonaSeleccionada) {
      alert("No se encontró la zona para registrar el consumo.");
      return;
    }

    const cantidad = parseFloat(valorConsumo);
    if (Number.isNaN(cantidad) || cantidad <= 0) {
      alert("Por favor ingrese una cantidad válida.");
      return;
    }

    if (!diaProceso) {
      alert("Selecciona el día del proceso antes de guardar.");
      return;
    }

    setGuardando(true);

    const { id: materialId, unidad } = materialConsumo;

    const { data: matData, error: matError } = await supabase
      .from("materiales")
      .select("presentacion_kg_por_bulto")
      .eq("id", materialId)
      .single();

    if (matError) {
      alert("❌ Error obteniendo presentación del material.");
      setGuardando(false);
      return;
    }

    const presentacion = matData?.presentacion_kg_por_bulto || 1;

    let bultos: number | null = null;
    let kg = 0;

    if (unidad === "bulto") {
      bultos = cantidad * -1;
      kg = cantidad * presentacion * -1;
    } else if (unidad === "litro") {
      bultos = null;
      kg = cantidad * -1;
    } else if (unidad === "unidad") {
      bultos = cantidad * -1;
      kg = 0;
    }

    const notasBase = `Consumo manual registrado (${cantidad} ${unidad}${
      cantidad !== 1 ? "s" : ""
    })`;
    let notas = notasBase;
    if (unidad !== "litro") {
      const stockMap = await obtenerStockMap(zonaSeleccionada.id);
      const stockActual = obtenerStockActual(stockMap, materialId);
      notas = buildNotaConStock({
        base: notasBase,
        tipo: "salida",
        cantidad,
        stockActual,
      });
    }

    const { error } = await supabase.from("movimientos_inventario").insert({
      zona_id: zonaSeleccionada.id,
      material_id: materialId,
      fecha: new Date().toISOString(),
      tipo: "salida",
      bultos,
      kg,
      ref_tipo: REF_TIPO_CONSUMO_SALMUERA,
      dia_proceso: diaProceso,
      notas,
    });

    if (error) {
      alert("❌ Error registrando consumo manual: " + error.message);
    } else {
      alert("✅ Consumo manual guardado correctamente");
      setShowConsumo(false);
      setDiaProceso("");
      if (diaProceso) {
        setDiasSemanaRegistrados((prev) =>
          prev.includes(diaProceso) ? prev : [...prev, diaProceso],
        );
      }
    }

    setGuardando(false);
  }, [materialConsumo, valorConsumo, zonaSeleccionada, diaProceso]);

  return (
    <PageContainer className="space-y-8">
      <header className="rounded-2xl border bg-gradient-to-r from-[#1F4F9C] via-[#1F4F9C]/90 to-[#29B8A6]/80 p-6 text-white shadow-lg">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Consumo Diario de Salmuera</h1>
          <p className="text-sm text-white/80">
            Selecciona la planta para registrar un consumo manual de salmuera en
            el inventario.
          </p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(ZONA_LABELS) as ZonaKey[]).map((key) => {
          const zona = zonas[key];
          const materialesActivos = zona?.materiales.length ?? 0;
          const disponible = Boolean(zona && materialesActivos > 0);

          return (
            <Button
              key={key}
              onClick={() => abrirConsumo(key)}
              className="flex h-40 w-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-900 shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:translate-y-0 disabled:border-slate-200/80 disabled:bg-slate-100/70 disabled:text-slate-400 disabled:shadow-none"
              disabled={!disponible || guardando}
            >
              <span className="text-lg font-semibold  uppercase tracking-[0.2em] text-slate-400">
                Zona
              </span>
              <span className="text-3xl font-semibold">{ZONA_LABELS[key]}</span>
            </Button>
          );
        })}
      </section>

      <ConsumoManualSalmueraDialog
        open={showConsumo}
        material={materialConsumo}
        value={valorConsumo}
        selectedDay={diaProceso}
        disabledDays={diasSemanaRegistrados}
        onClose={() => {
          if (guardando) return;
          setShowConsumo(false);
          setValorConsumo("");
          setDiaProceso("");
          setDiasSemanaRegistrados([]);
        }}
        onChange={setValorConsumo}
        onDayChange={setDiaProceso}
        onSubmit={() => {
          if (!guardando) void guardarConsumoManual();
        }}
        submitting={guardando}
      />
    </PageContainer>
  );
}
