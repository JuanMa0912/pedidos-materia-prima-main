import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabasedamin";
import type { InventarioActualRow } from "@/app/(dashboard)/_components/_types";

type ZonaRow = {
  id: string;
  nombre: string | null;
};

const ZONAS_OBJETIVO = new Set(["desposte", "desprese", "panificadora"]);

function normalizarNombreZona(nombre: string | null) {
  return nombre?.trim().toLowerCase() ?? "";
}

function obtenerFechaSnapshot() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : null;
};

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: zonas, error: zonasError } = await supabaseAdmin
      .from("zonas")
      .select("id, nombre")
      .eq("activo", true);

    if (zonasError) {
      console.error("inventario snapshots cron zonas error", zonasError);
      return NextResponse.json(
        { error: "No se pudieron obtener las zonas" },
        { status: 500 },
      );
    }

    const zonasObjetivo = (zonas ?? []).filter((zona) =>
      ZONAS_OBJETIVO.has(normalizarNombreZona(zona.nombre)),
    ) as ZonaRow[];

    if (!zonasObjetivo.length) {
      return NextResponse.json(
        { error: "No se encontraron zonas objetivo" },
        { status: 404 },
      );
    }

    const fechaSnapshot = obtenerFechaSnapshot();
    let totalSnapshots = 0;

    for (const zona of zonasObjetivo) {
      const { data: inventario, error: inventarioError } =
        await supabaseAdmin.rpc("inventario_actual", {
          p_zona: zona.id,
        });

      if (inventarioError) {
        console.error("inventario snapshots cron rpc error", {
          zonaId: zona.id,
          error: inventarioError,
        });
        return NextResponse.json(
          { error: "No se pudo obtener el inventario actual" },
          { status: 500 },
        );
      }

      const filas = (inventario as InventarioActualRow[]) ?? [];
      if (!filas.length) continue;

      const snapshots = filas.map((item) => ({
        fecha: fechaSnapshot,
        bultos:
          toNumberOrNull(item.stock_bultos) ??
          toNumberOrNull(item.stock) ??
          null,
        kg: toNumberOrNull(item.stock_kg),
        material_id: item.material_id,
        zona_id: item.zona_id,
      }));

      const { error: insertError } = await supabaseAdmin
        .from("inventario_snapshots")
        .upsert(snapshots, {
          onConflict: "fecha,material_id,zona_id",
        });

      if (insertError) {
        console.error("inventario snapshots cron insert error", {
          zonaId: zona.id,
          error: insertError,
        });
        return NextResponse.json(
          { error: "No se pudieron guardar los snapshots" },
          { status: 500 },
        );
      }

      totalSnapshots += snapshots.length;
    }

    return NextResponse.json({
      ok: true,
      fecha: fechaSnapshot,
      total: totalSnapshots,
      zonas: zonasObjetivo.map((zona) => zona.nombre ?? zona.id),
    });
  } catch (err) {
    console.error("inventario snapshots cron unexpected", err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "No se pudieron guardar los snapshots" },
      { status: 500 },
    );
  }
}
