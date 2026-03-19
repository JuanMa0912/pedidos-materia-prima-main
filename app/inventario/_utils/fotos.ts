export function parseFotoUrls(fotoUrl: string | null): string[] {
  if (!fotoUrl) return [];

  if (fotoUrl.trim().startsWith("[") && fotoUrl.trim().endsWith("]")) {
    try {
      const parsed = JSON.parse(fotoUrl) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (value): value is string =>
            typeof value === "string" && value.trim() !== ""
        );
      }
    } catch (error) {
      console.warn("No se pudo parsear foto_url como JSON", error);
    }
  }

  return fotoUrl
    .split(/\||\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function serializeFotoUrls(urls: string[]): string | null {
  const limpias = urls.map((url) => url.trim()).filter(Boolean);
  return limpias.length ? limpias.join("|") : null;
}
