import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabasedamin";

export async function GET(request: NextRequest) {
  const zonaId = request.nextUrl.searchParams.get("zonaId");
  const materialId = request.nextUrl.searchParams.get("materialId");
  const fecha = request.nextUrl.searchParams.get("fecha");
  const mes = request.nextUrl.searchParams.get("mes");

  if (!zonaId || !materialId) {
    return NextResponse.json(
      { error: "zonaId y materialId son obligatorios" },
      { status: 400 },
    );
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from("inventario_snapshots")
      .select("id, fecha, bultos, kg, material_id, zona_id, created_at")
      .eq("zona_id", zonaId)
      .eq("material_id", materialId)
      .order("fecha", { ascending: false });

    if (fecha) {
      query = query.eq("fecha", fecha);
    } else if (mes) {
      const [year, month] = mes.split("-");
      const yearNumber = Number(year);
      const monthNumber = Number(month);
      let appliedMonthFilter = false;

      if (
        Number.isFinite(yearNumber) &&
        Number.isFinite(monthNumber) &&
        monthNumber >= 1 &&
        monthNumber <= 12
      ) {
        const startDate = `${yearNumber}-${String(monthNumber).padStart(
          2,
          "0",
        )}-01`;
        const lastDay = new Date(yearNumber, monthNumber, 0).getDate();
        const endDate = `${yearNumber}-${String(monthNumber).padStart(
          2,
          "0",
        )}-${String(lastDay).padStart(2, "0")}`;
        query = query.gte("fecha", startDate).lte("fecha", endDate);
        appliedMonthFilter = true;
      }

      if (!appliedMonthFilter) {
        query = query.limit(30);
      }
    } else {
      query = query.limit(30);
    }

    const { data, error } = await query;

    if (error) {
      console.error("inventario_snapshots error:", error);
      return NextResponse.json(
        { error: "No se pudo obtener snapshots" },
        { status: 500 },
      );
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("inventario_snapshots unexpected", err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "No se pudo obtener snapshots" },
      { status: 500 },
    );
  }
}
