import { NextResponse } from "next/server";
import { email, z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabasedamin";

const createUserSchema = z.object({
  email: z.string().nonempty("El campo es obligatorio"),
  password: z
    .string()
    .nonempty("El campo es obligatorio")
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .max(128, "la contraseña es demasiado larga"),
});

const updatePasswordSchema = z.object({
  id: z
    .string()
    .nonempty("El id es obligatorio")
    .min(1, "El id no puede estar vacio")
    .max(128, "la contraseña es demasiado larga"),
  password: createUserSchema.shape.password,
});

function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    { error: "datos invalidos", issues: error.flatten() },
    { status: 400 }
  );
}

function supabaseInitErrorResponse(error: unknown) {
  console.error("admin/users supabase init error", error);
  const message =
    error instanceof Error
      ? error.message
      : "No se pudo inicializar el cliente de Supabase";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(data.users);
  } catch (error) {
    return supabaseInitErrorResponse(error);
  }
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const { email, password } = parsed.data;
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    return supabaseInitErrorResponse(error);
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data.user);
}

export async function PUT(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON Invalido" }, { status: 400 });
  }

  const parsed = updatePasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const { id, password } = parsed.data;
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    return supabaseInitErrorResponse(error);
  }
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    password,
  });
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data.user);
}
