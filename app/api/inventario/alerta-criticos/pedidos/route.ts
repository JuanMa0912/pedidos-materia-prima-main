import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ESTADOS_PENDIENTES = ["enviado"] as const;

type RequestBody = {
  zonaIds?: string[];
  materialIds?: string[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const zonaIds = Array.isArray(body?.zonaIds) ? body.zonaIds : [];
    const materialIds = Array.isArray(body?.materialIds) ? body.materialIds : [];

    if (!zonaIds.length || !materialIds.length) {
      return NextResponse.json({ ok: true, pedidos: [] });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || (!serviceKey && !anonKey)) {
      return NextResponse.json(
        { ok: false, error: "No se encontraron credenciales de Supabase" },
        { status: 500 },
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceKey ?? anonKey ?? "",
      { auth: { persistSession: false } },
    );
    const materialIdSet = new Set(materialIds.map((id) => String(id)));
    const pedidosSet = new Set<string>();

    const { data: dataFromPedidos, error: errorFromPedidos } =
      await supabaseAdmin
        .from("pedidos")
        .select("zona_id, pedido_items(material_id)")
        .in("estado", ESTADOS_PENDIENTES)
        .in("zona_id", zonaIds);

    if (errorFromPedidos) {
      console.warn("alerta criticos: error pedidos", errorFromPedidos);
    }

    (dataFromPedidos ?? []).forEach((pedido) => {
      const zona = (pedido as { zona_id?: string }).zona_id;
      const items = (pedido as { pedido_items?: { material_id?: string }[] })
        .pedido_items;
      if (!zona || !Array.isArray(items)) return;
      items.forEach((item) => {
        if (!item?.material_id) return;
        const materialId = String(item.material_id);
        if (!materialIdSet.has(materialId)) return;
        pedidosSet.add(`${zona}|${materialId}`);
      });
    });

    const { data: dataFromItems, error: errorFromItems } = await supabaseAdmin
      .from("pedido_items")
      .select("material_id, pedidos!inner(estado, zona_id)")
      .in("material_id", materialIds)
      .in("pedidos.estado", ESTADOS_PENDIENTES)
      .in("pedidos.zona_id", zonaIds);

    if (errorFromItems) {
      console.warn("alerta criticos: error pedido_items", errorFromItems);
    }

    (dataFromItems ?? []).forEach((item) => {
      const pedidoRaw = (item as { pedidos?: unknown }).pedidos;
      const pedido = Array.isArray(pedidoRaw)
        ? (pedidoRaw[0] as { zona_id?: string } | undefined)
        : (pedidoRaw as { zona_id?: string } | null | undefined);
      if (!pedido?.zona_id || !item.material_id) return;
      const materialId = String(item.material_id);
      if (!materialIdSet.has(materialId)) return;
      pedidosSet.add(`${pedido.zona_id}|${materialId}`);
    });

    if (errorFromPedidos && errorFromItems) {
      return NextResponse.json(
        { ok: false, error: "No se pudieron validar pedidos" },
        { status: 500 },
      );
    }

    const pedidos = Array.from(pedidosSet).map((key) => {
      const [zonaId, materialId] = key.split("|");
      return { zonaId, materialId };
    });

    return NextResponse.json({ ok: true, pedidos });
  } catch (error) {
    console.error("alerta criticos pedidos unexpected", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo validar pedidos" },
      { status: 500 },
    );
  }
}
