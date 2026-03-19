import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabasedamin";
import type { InventarioActualRow } from "@/app/(dashboard)/_components/_types";

export async function GET(request: NextRequest) {
  const zonaParam = request.nextUrl.searchParams.get("zonaId");
  const zonaId = zonaParam && zonaParam.trim().length > 0 ? zonaParam : null;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (zonaId) {
      const { data: zonaInfo, error: zonaInfoError } = await supabaseAdmin
        .from("zonas")
        .select("id, nombre")
        .eq("id", zonaId)
        .maybeSingle();

      if (zonaInfoError) {
        console.error("inventario_actual zona nombre error", zonaInfoError);
      }

      const zonaNombre = zonaInfo?.nombre ?? null;

      const { data, error } = await supabaseAdmin.rpc("inventario_actual", {
        p_zona: zonaId,
      });

      if (error) {
        console.error("🔥 inventario_actual RPC ERROR:", error);
        return NextResponse.json(
          { error: error.message, details: error },
          { status: 500 }
        );
      }
      const materiales = ((data as InventarioActualRow[]) ?? []).map(
        (item) => ({
          ...item,
          zona_nombre: item.zona_nombre ?? zonaNombre,
        })
      );

      return NextResponse.json(materiales);
    }

    const { data: zonas, error: zonasError } = await supabaseAdmin
      .from("zonas")
      .select("id, nombre")
      .eq("activo", true);

    if (zonasError) {
      console.error("inventario_actual zonas error", zonasError);
      return NextResponse.json(
        { error: "No se pudo obtener el inventario actual" },
        { status: 500 }
      );
    }

    const zonaNombrePorId = new Map<string, string | null>();
    const zonaIds = (zonas ?? [])
      .map((zona) => {
        if (typeof zona.id === "string" && zona.id.length > 0) {
          zonaNombrePorId.set(zona.id, zona.nombre ?? null);
          return zona.id;
        }
        return null;
      })
      .filter((id): id is string => id !== null);

    const resultados: InventarioActualRow[] = [];

    for (const id of zonaIds) {
      const { data, error } = await supabaseAdmin.rpc("inventario_actual", {
        p_zona: id,
      });

      if (error) {
        console.error("inventario_actual error", { zonaId: id, error });
        return NextResponse.json(
          { error: "No se pudo obtener el inventario actual" },
          { status: 500 }
        );
      }

      if (Array.isArray(data)) {
        const zonaNombre = zonaNombrePorId.get(id) ?? null;
        const enriquecidos = (data as InventarioActualRow[]).map((item) => ({
          ...item,
          zona_nombre: item.zona_nombre ?? zonaNombre,
        }));
        resultados.push(...enriquecidos);
      }
    }

    return NextResponse.json(resultados);
  } catch (err) {
    console.error("inventario_actual unexpected", err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "No se pudo obtener el inventario actual" },
      { status: 500 }
    );
  }
}
