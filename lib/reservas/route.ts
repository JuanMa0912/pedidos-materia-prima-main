import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabasedamin";

type ReservaResponseRow = {
  zona_id: string;
  material_id: string;
  stock_kg: number | null;
  stock_bultos: number | null;
  updated_at: string | null;
  material: {
    id: string;
    nombre: string | null;
    unidad_medida: "bulto" | "unidad" | "litro" | null;
    presentacion_kg_por_bulto: number | null;
    tasa_consumo_diaria_kg: number | null;
  } | null;
};

export async function GET(request: NextRequest) {
  const zonaId = request.nextUrl.searchParams.get("zonaId") ?? undefined;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const baseQuery = supabaseAdmin
      .from("consumo_automatico_reservas")
      .select(
        "zona_id,material_id,stock_kg,stock_bultos,updated_at,material:materiales(id,nombre,unidad_medida,presentacion_kg_por_bulto,tasa_consumo_diaria_kg)"
      )
      .order("material_id", { ascending: true });

    const query = zonaId ? baseQuery.eq("zona_id", zonaId) : baseQuery;

    const { data, error } = await query;

    if (error) {
      console.error("consumo reservas", error);
      return NextResponse.json(
        { error: "No se pudo obtener el stock de consumo automático" },
        { status: 500 }
      );
    }

    const reservas = (Array.isArray(data)
      ? data
      : []) as unknown as ReservaResponseRow[];

    return NextResponse.json(reservas);
  } catch (error) {
    console.error("consumo reservas unexpected", error);
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo obtener el stock de consumo automático";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
