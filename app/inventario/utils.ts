import { fmtNum } from "@/lib/format";

import type { Unidad } from "@/app/inventario/types";

export function formatUnidad(valor: number, unidad: Unidad) {
  const plural =
    unidad === "bulto" ? "bultos" : unidad === "unidad" ? "unidades" : "litros";
  const singular = unidad;
  return `${fmtNum(valor)} ${valor === 1 ? singular : plural}`;
}

export const obtenerEtiquetaCobertura = (cobertura: number | null) => {
  if (cobertura === null) {
    return {
      texto: "sin estimacion",
      estilo: "bg-slate-100 text-slate-700",
    } as const;
  }
  if (cobertura <= 2) {
    return {
      texto: "Critico",
      estilo: "bg-red-100 text-red-800",
    } as const;
  }
  if (cobertura <= 5) {
    return {
      texto: "En observación",
      estilo: "bg-amber-100 text-amber-800",
    } as const;
  }

  return {
    texto: "Estable",
    estilo: "bg-emerald-100 text-emerald-800",
  } as const;
};
