import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabasedamin";
import { getLocalDateISO } from "@/lib/utils";

type MaterialRegistro = {
  id: string;
  unidad_medida: "bulto" | "unidad" | "litro";
  presentacion_kg_por_bulto: number | null;
};

const pedidoItemSchema = z.object({
  materialId: z
    .string()
    .trim()
    .nonempty({ message: "El material es obligatorio" }),

  bultos: z
    .number()
    .int({ message: "La cantidad de bultos debe ser un número entero" })
    .min(1, { message: "La cantidad mínima es 1" }),

  kg: z
    .union([
      z.number().nonnegative({ message: "Los kilos no pueden ser negativos" }),
      z.null(),
      z.undefined(),
    ])
    .optional(),
});

const crearPedidoSchema = z.object({
  zonaId: z.string().trim().min(1, "La zona es obligatoria"),
  solicitante: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullish(),
  fechaEntrega: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 ||
        /^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isNaN(Date.parse(value)),
      {
        message: "La fecha de entrega no es válida",
      }
    )
    .transform((value) => {
      if (!value || value.length === 0) {
        return null;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }
      return new Date(value).toISOString().slice(0, 10);
    })
    .nullish(),
  notas: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullish(),
  items: z.array(pedidoItemSchema).min(1, "Debes agregar al menos un material"),
});

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();

  let payload: z.infer<typeof crearPedidoSchema>;
  try {
    const json = await request.json();
    payload = crearPedidoSchema.parse(json);
  } catch (error) {
    console.error("crear pedido: payload inválido", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", detalles: error.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "No se pudo procesar la solicitud" },
      { status: 400 }
    );
  }

  const zonaId = payload.zonaId;
  const solicitante = payload.solicitante ?? null;
  const fechaEntrega = payload.fechaEntrega ?? null;
  const notas = payload.notas ?? null;
  const items = payload.items;

  const itemIds = Array.from(new Set(items.map((item) => item.materialId)));
  if (itemIds.length !== items.length) {
    return NextResponse.json(
      { error: "Hay materiales repetidos en el pedido" },
      { status: 400 }
    );
  }

  try {
    const { data: zonaData, error: zonaError } = await supabaseAdmin
      .from("zonas")
      .select("id")
      .eq("id", zonaId)
      .maybeSingle();

    if (zonaError) {
      console.error("crear pedido: error buscando zona", zonaError);
      return NextResponse.json(
        { error: "No se pudo validar la zona" },
        { status: 500 }
      );
    }

    if (!zonaData) {
      return NextResponse.json(
        { error: "La zona indicada no existe" },
        { status: 400 }
      );
    }

    const { data: materiales, error: materialesError } = await supabaseAdmin
      .from("materiales")
      .select("id, unidad_medida, presentacion_kg_por_bulto")
      .in("id", itemIds)
      .returns<MaterialRegistro[]>();

    if (materialesError) {
      console.error(
        "crear pedido: error recuperando materiales",
        materialesError
      );
      return NextResponse.json(
        { error: "No se pudieron validar los materiales" },
        { status: 500 }
      );
    }

    if (!materiales || materiales.length !== itemIds.length) {
      return NextResponse.json(
        { error: "Alguno de los materiales indicados no existe" },
        { status: 400 }
      );
    }

    const materialPorId = new Map<string, MaterialRegistro>();
    for (const material of materiales) {
      if (
        !material ||
        typeof material.id !== "string" ||
        material.id.length === 0
      ) {
        return NextResponse.json(
          {
            error:
              "Alguno de los materiales indicados no tiene un identificador válido",
          },
          { status: 400 }
        );
      }
      materialPorId.set(material.id, material);
    }

    for (const item of items) {
      const meta = materialPorId.get(item.materialId);
      if (!meta) {
        continue;
      }

      if (meta.unidad_medida === "unidad" && item.kg != null) {
        return NextResponse.json(
          {
            error:
              "Los materiales medidos por unidad no deben incluir cantidad en kilogramos",
          },
          { status: 400 }
        );
      }

      if (item.kg != null && !Number.isFinite(item.kg)) {
        return NextResponse.json(
          { error: "Los kilos deben ser un número válido" },
          { status: 400 }
        );
      }

      if (item.kg != null && item.kg < 0) {
        return NextResponse.json(
          { error: "Los kilos no pueden ser negativos" },
          { status: 400 }
        );
      }

      if (meta.unidad_medida === "bulto") {
        const presentacion = meta.presentacion_kg_por_bulto ?? 0;
        if (presentacion <= 0) {
          return NextResponse.json(
            {
              error:
                "El material seleccionado no tiene una presentación de kilogramos válida",
            },
            { status: 400 }
          );
        }
        const esperado = presentacion * item.bultos;
        if (item.kg == null || Math.abs(item.kg - esperado) > 0.0001) {
          return NextResponse.json(
            {
              error:
                "Los kilos del material no coinciden con los bultos solicitados",
            },
            { status: 400 }
          );
        }
      }

      if (meta.unidad_medida === "litro") {
        if (item.kg == null) {
          return NextResponse.json(
            {
              error:
                "Los materiales medidos en litros deben indicar los kilogramos equivalentes",
            },
            { status: 400 }
          );
        }
        if (Math.abs(item.kg - item.bultos) > 0.0001) {
          return NextResponse.json(
            {
              error:
                "Para materiales en litros, los kilos deben coincidir con la cantidad",
            },
            { status: 400 }
          );
        }
      }
    }

    const totalBultos = items.reduce((sum, item) => sum + item.bultos, 0);
    const totalKg = items.reduce(
      (sum, item) => sum + (item.kg != null ? item.kg : 0),
      0
    );

    const fechaPedido = getLocalDateISO();

    const { data: pedidoInsert, error: pedidoError } = await supabaseAdmin
      .from("pedidos")
      .insert({
        zona_id: zonaId,
        solicitante,
        fecha_pedido: fechaPedido,
        fecha_entrega: fechaEntrega,
        notas,
        estado: "enviado",
        total_bultos: totalBultos,
        total_kg: totalKg,
      })
      .select("id")
      .single();

    if (pedidoError || !pedidoInsert) {
      console.error("crear pedido: error insertando pedido", pedidoError);
      return NextResponse.json(
        { error: "No se pudo crear el pedido" },
        { status: 500 }
      );
    }

    const pedidoId = pedidoInsert.id;
    const itemsToInsert = items.map((item) => ({
      pedido_id: pedidoId,
      material_id: item.materialId,
      bultos: item.bultos,
      kg: item.kg ?? null,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("pedido_items")
      .insert(itemsToInsert);

    if (itemsError) {
      console.error("crear pedido: error insertando items", itemsError);
      await supabaseAdmin.from("pedidos").delete().eq("id", pedidoId);
      return NextResponse.json(
        { error: "No se pudieron guardar los materiales del pedido" },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: pedidoId }, { status: 201 });
  } catch (error) {
    console.error("crear pedido: inesperado", error);
    return NextResponse.json(
      { error: "Ocurrió un error al crear el pedido" },
      { status: 500 }
    );
  }
}
