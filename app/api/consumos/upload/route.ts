import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabasedamin";

const BUCKET_NAME = "consumos";

async function ensureBucketExists() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: buckets, error: listError } =
    await supabaseAdmin.storage.listBuckets();
  if (listError) {
    throw listError;
  }

  const exists = buckets?.some((bucket) => bucket.name === BUCKET_NAME);
  if (exists) return;

  const { error: createError } = await supabaseAdmin.storage.createBucket(
    BUCKET_NAME,
    {
      public: true,
    }
  );

  if (createError) {
    throw createError;
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Archivo de foto no recibido" },
        { status: 400 }
      );
    }

    await ensureBucketExists();

    const extension = file.name.split(".").pop() || "jpg";
    const uniqueId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filePath = `${uniqueId}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicData.publicUrl, path: filePath });
  } catch (error) {
    console.error("❌ Error subiendo foto de consumo", error);
    return NextResponse.json(
      { error: "No se pudo subir la foto" },
      { status: 500 }
    );
  }
}
