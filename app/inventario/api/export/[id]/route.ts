// app/api/export/[id]/route.ts
import PDFDocument from "pdfkit";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

const paramsSchema = z.object({
  id: z
    .string()
    .nonempty("el Id es obligatorio")
    .min(1, "El Id es obligatorio")
    .max(128, "El id es demasiado largo")
    .refine((value) => /^[a-zA-Z0-9_-]+$/.test(value), {
      message: "El id contiene caracteres no permitidos",
    }),
});

// Fuerza runtime Node (pdfkit necesita Node, no Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _: NextRequest,
  context: { params?: Promise<{ id: string }> }
) {
  const rawParams = context.params ? await context.params : {};
  const parsedParams = paramsSchema.safeParse(rawParams);
  if (!parsedParams.success) {
    return new Response(
      JSON.stringify({
        error: "parametros invalidos",
        issues: parsedParams.error.flatten(),
      }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const pedidoId = parsedParams.data.id;

  // 1) Pedido
  const { data: pedido, error: errPedido } = await supabase
    .from("pedidos")
    .select("id,fecha_pedido,solicitante,estado,zona_id")
    .eq("id", pedidoId)
    .single();
  if (errPedido || !pedido) {
    return new Response(JSON.stringify({ error: "Pedido no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2) Ítems (sin join) -> traemos material_id y kg
  const { data: items } = await supabase
    .from("pedido_items")
    .select("material_id,kg")
    .eq("pedido_id", pedidoId)
    .returns<{ material_id: string; kg: number }[]>();

  // 3) Materiales (nombre/proveedor) para esos IDs
  const matIds = Array.from(new Set((items ?? []).map((r) => r.material_id)));
  const matsMap = new Map<
    string,
    { nombre: string; proveedor: string | null }
  >();
  if (matIds.length) {
    const { data: mats } = await supabase
      .from("materiales")
      .select("id,nombre,proveedor")
      .in("id", matIds)
      .returns<{ id: string; nombre: string; proveedor: string | null }[]>();
    (mats ?? []).forEach((m) =>
      matsMap.set(m.id, { nombre: m.nombre, proveedor: m.proveedor })
    );
  }

  // 4) PDF en memoria
  const doc = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => {});

  // Título
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("PEDIDO SALMUERA CARNES", { align: "center" });
  doc.moveDown(2);

  // Tabla con bordes como el ejemplo
  const startX = 50;
  let y = doc.y;
  const col1 = 200;
  const col2 = 300;
  const rowH = 25;

  const cell = (
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    bold = false
  ) => {
    doc.rect(x, y, w, h).stroke();
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(12);
    doc.text(String(text ?? ""), x + 6, y + 7, {
      width: w - 12,
      align: "left",
    });
  };

  // Cabecera columnas
  cell("CANTIDAD KILOS", startX, y, col1, rowH, true);
  cell("EMPRESA", startX + col1, y, col2, rowH, true);
  y += rowH;

  // Filas: usamos proveedor como “empresa” (si no, mostramos nombre del material)
  for (const it of items ?? []) {
    const mat = matsMap.get(it.material_id);
    const empresa = mat?.proveedor ?? mat?.nombre ?? "";
    cell(`${Number(it.kg).toFixed(0)} KG`, startX, y, col1, rowH);
    cell(empresa, startX + col1, y, col2, rowH);
    y += rowH;
  }

  // Última fila: fecha de entrega (usamos fecha del pedido)
  cell("FECHA DE ENTREGA:", startX, y, col1, rowH, true);
  cell(pedido.fecha_pedido, startX + col1, y, col2, rowH, true);

  doc.end();

  // Combinar chunks -> Uint8Array para BodyInit
  const buf = Buffer.concat(chunks);
  const body = new Uint8Array(buf); // ✅ evita el error de tipos

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=pedido-${pedidoId}.pdf`,
    },
  });
}
