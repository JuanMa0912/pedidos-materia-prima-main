// lib/format.ts
// Formateadores base
export const fNum = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1,
});
export const fNum2 = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const fCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
});
export const fDate = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

// Helpers de formato (exportados)
export const fmtNum = (v: number | null | undefined) =>
  fNum.format(Number(v ?? 0));
export const fmt2 = (v: number | null | undefined) =>
  fNum2.format(Number(v ?? 0));
export const fmtCOP = (v: number | null | undefined) =>
  fCOP.format(Number(v ?? 0));
const parseDate = (d: string | Date): Date => {
  if (typeof d === "string") {
    const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDateOnly.test(d)) {
      const [year, month, day] = d.split("-").map(Number);
      if (
        Number.isFinite(year) &&
        Number.isFinite(month) &&
        Number.isFinite(day)
      ) {
        return new Date(year, month - 1, day);
      }
    }
    const parsed = new Date(d);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return d instanceof Date ? d : new Date(d);
};

export const fmtDate = (d: string | Date | null | undefined) => {
  d ? fDate.format(parseDate(d)) : "—";

  const parsedDate = (() => {
    if (d instanceof Date) {
      return d;
    }

    if (typeof d === "string") {
      const isoDateOnlyMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);

      if (isoDateOnlyMatch) {
        const [, year, month, day] = isoDateOnlyMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
      }

      const parsed = new Date(d);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  })();

  if (!parsedDate) return "—";

  return fDate.format(parsedDate);
};

// Parser numérico seguro (para inputs tipo "1.234,56" o "1234.56")
export const toNum = (x: unknown): number => {
  if (typeof x === "number") return isFinite(x) ? x : 0;
  if (typeof x !== "string") return 0;
  // normaliza miles/punto decimal en locales es-CO
  const s = x.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

export function show2(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
