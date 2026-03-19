import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabasedamin";

const SIGNATURE_BUCKET = "canastillas-firmas";
const MAX_SIGNATURE_SIZE = 200 * 1024;
const MAX_TEXT_LENGTH = 120;
const MAX_NOTES_LENGTH = 500;
const MAX_QUANTITY = 5000;
const ALLOWED_SIGNATURE_MIME = ["image/png", "image/jpeg"];

const itemSchema = z.object({
  tipo_canastilla: z.string().trim().min(1).max(50),
  proveedor: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  cantidad: z
    .number()
    .int({ message: "La cantidad debe ser un número entero" })
    .min(1, { message: "La cantidad mínima es 1" })
    .max(MAX_QUANTITY, {
      message: `La cantidad máxima es ${MAX_QUANTITY}`,
    }),
});

const payloadSchema = z.object({
  consecutivo: z
    .string()
    .trim()
    .regex(/^\d+$/, { message: "El consecutivo debe ser numérico" }),
  fecha: z
    .string()
    .trim()
    .refine(
      (value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(Date.parse(value)),
      {
        message: "La fecha no es válida",
      },
    ),
  placa_vh: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9]{6}$/, {
      message: "La placa VH debe tener 6 caracteres alfanuméricos",
    }),
  nombre_cliente: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  nombre_autoriza: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  observaciones: z
    .string()
    .trim()
    .max(MAX_NOTES_LENGTH)
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null)),
  entryMode: z.enum(["ingreso", "devolucion"]),
  firma: z.string().trim().min(1, "La firma es obligatoria"),
  items: z.array(itemSchema).min(1, "Debes agregar al menos una canastilla"),
});

async function ensureBucketExists() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) throw error;

  const exists = buckets?.some((bucket) => bucket.name === SIGNATURE_BUCKET);
  if (exists) return;

  const { error: createError } = await supabaseAdmin.storage.createBucket(
    SIGNATURE_BUCKET,
    { public: false },
  );
  if (createError) throw createError;
}

function parseSignature(signature: string) {
  let rawBase64 = signature.trim();
  let mimeType = "image/png";

  if (rawBase64.startsWith("data:")) {
    const matches = rawBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error("El formato de la firma no es válido.");
    }
    mimeType = matches[1];
    rawBase64 = matches[2];
  }

  if (!ALLOWED_SIGNATURE_MIME.includes(mimeType)) {
    throw new Error("El tipo de firma no es permitido.");
  }

  const normalizedBase64 = rawBase64.replace(/\s/g, "");
  const buffer = Buffer.from(normalizedBase64, "base64");

  if (!buffer.length) {
    throw new Error("La firma está vacía.");
  }
  if (buffer.length > MAX_SIGNATURE_SIZE) {
    throw new Error(
      `La firma supera el tamaño máximo de ${MAX_SIGNATURE_SIZE / 1024} KB.`,
    );
  }

  const extension = mimeType === "image/jpeg" ? "jpg" : "png";
  return { buffer, mimeType, extension };
}

export async function POST(request: Request) {
  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", detalles: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "No se pudo procesar la solicitud" },
      { status: 400 },
    );
  }

  let signatureBuffer: Buffer;
  let signatureMimeType: string;
  let signatureExtension: string;
  try {
    const parsed = parseSignature(payload.firma);
    signatureBuffer = parsed.buffer;
    signatureMimeType = parsed.mimeType;
    signatureExtension = parsed.extension;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "La firma no es válida.",
      },
      { status: 400 },
    );
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    await ensureBucketExists();

    const uniqueId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filePath = `firmas/${uniqueId}.${signatureExtension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(SIGNATURE_BUCKET)
      .upload(filePath, signatureBuffer, { contentType: signatureMimeType });

    if (uploadError) {
      return NextResponse.json(
        { error: "No se pudo subir la firma." },
        { status: 500 },
      );
    }

    const rows = payload.items.map((item) => ({
      consecutivo: payload.consecutivo,
      fecha: payload.fecha,
      fecha_devolucion:
        payload.entryMode === "devolucion" ? payload.fecha : null,
      placa_vh: payload.placa_vh,
      tipo_canastilla: item.tipo_canastilla,
      nombre_cliente: payload.nombre_cliente,
      proveedor: item.proveedor,
      cantidad: item.cantidad,
      nombre_autoriza: payload.nombre_autoriza,
      observaciones: payload.observaciones ?? null,
      firma: `storage:${filePath}`,
    }));

    const { error } = await supabaseAdmin.from("canastillas").insert(rows);
    if (error) {
      await supabaseAdmin.storage.from(SIGNATURE_BUCKET).remove([filePath]);
      return NextResponse.json(
        { error: "No se pudo guardar el registro." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("canastillas: error guardando registro", error);
    return NextResponse.json(
      { error: "No se pudo guardar el registro." },
      { status: 500 },
    );
  }
}
