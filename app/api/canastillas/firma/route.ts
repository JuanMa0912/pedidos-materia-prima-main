import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabasedamin";

const SIGNATURE_BUCKET = "canastillas-firmas";
const SIGNATURE_TTL_SECONDS = 60 * 10;

const payloadSchema = z.object({
  path: z.string().trim().min(1),
});

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

  if (payload.path.includes("..") || payload.path.startsWith("/")) {
    return NextResponse.json(
      { error: "La ruta de la firma no es válida." },
      { status: 400 },
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage
    .from(SIGNATURE_BUCKET)
    .createSignedUrl(payload.path, SIGNATURE_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "No se pudo generar la firma." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
