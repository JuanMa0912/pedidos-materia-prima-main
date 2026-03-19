import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabasedamin";

type ProviderPayload = {
  id?: string | null;
  nombre?: string;
  contacto?: string | null;
  telefono?: string | null;
  notas?: string | null;
  activo?: boolean | null;
};

const buildPayload = (body: ProviderPayload) => ({
  nombre: body.nombre?.trim(),
  contacto: body.contacto?.trim() || null,
  telefono: body.telefono?.trim() || null,
  notas: body.notas?.trim() || null,
  activo: body.activo ?? true,
});

export async function POST(request: Request) {
  const body = (await request.json()) as ProviderPayload;

  if (!body.nombre?.trim()) {
    return NextResponse.json(
      { error: "El nombre del proveedor es obligatorio." },
      { status: 400 },
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("canastillas_proveedores")
    .insert(buildPayload(body));

  if (error) {
    return NextResponse.json(
      { error: "No se pudo guardar el proveedor." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as ProviderPayload;

  if (!body.id) {
    return NextResponse.json(
      { error: "No se encontró el proveedor a actualizar." },
      { status: 400 },
    );
  }

  if (!body.nombre?.trim()) {
    return NextResponse.json(
      { error: "El nombre del proveedor es obligatorio." },
      { status: 400 },
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("canastillas_proveedores")
    .update(buildPayload(body))
    .eq("id", body.id);

  if (error) {
    return NextResponse.json(
      { error: "No se pudo guardar el proveedor." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as ProviderPayload;

  if (!body.id) {
    return NextResponse.json(
      { error: "No se encontró el proveedor a eliminar." },
      { status: 400 },
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("canastillas_proveedores")
    .delete()
    .eq("id", body.id)
    .select("id");

  if (!error && data && data.length > 0) {
    return NextResponse.json({ ok: true, fallback: false });
  }

  const { error: deactivateError } = await supabaseAdmin
    .from("canastillas_proveedores")
    .update({ activo: false })
    .eq("id", body.id)
    .select("id");

  if (deactivateError) {
    return NextResponse.json(
      { error: "No se pudo eliminar el proveedor." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, fallback: true });
}
