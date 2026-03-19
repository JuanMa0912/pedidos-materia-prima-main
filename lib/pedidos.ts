import type { PostgrestError } from "@supabase/supabase-js";

export function shouldRetryEstadoRecibido(error: PostgrestError | null) {
  if (!error) return false;

  const code = error.code ?? "";
  const message = error.message?.toLowerCase() ?? "";

  if (!code && !message) {
    return true;
  }

  return (
    code === "22P02" ||
    code == "23514" ||
    message.includes("recibido") ||
    message.includes("invalid input") ||
    message.includes("enum")
  );
}
