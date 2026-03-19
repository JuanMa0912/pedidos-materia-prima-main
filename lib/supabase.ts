import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url) {
  throw new Error(
    "La variable NEXT_PUBLIC_SUPABASE_URL no está definida. Revisa tu archivo de entorno."
  );
}

if (!anon) {
  throw new Error(
    "La variable NEXT_PUBLIC_SUPABASE_ANON_KEY no está definida. Revisa tu archivo de entorno."
  );
}

export const supabase = createClient(url, anon);
