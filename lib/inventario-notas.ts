import type { InventarioActualRow } from "@/app/(dashboard)/_components/_types";
import { toNum } from "@/lib/format";

export type StockBultosMap = Map<string, number>;

type NotaArgs = {
  base: string;
  tipo: "entrada" | "salida";
  cantidad: number | null;
  stockActual: number | null;
};

const normalizarNumero = (valor: unknown) => {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  if (typeof valor === "string") {
    return toNum(valor);
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

export const buildStockBultosMap = (
  rows: InventarioActualRow[],
): StockBultosMap => {
  return rows.reduce<StockBultosMap>((acc, item) => {
    acc.set(item.material_id, normalizarNumero(item.stock_bultos));
    return acc;
  }, new Map());
};

export const buildNotaConStock = ({
  base,
  tipo,
  cantidad,
  stockActual,
}: NotaArgs): string => {
  if (
    cantidad === null ||
    !Number.isFinite(cantidad) ||
    stockActual === null ||
    !Number.isFinite(stockActual)
  ) {
    return base;
  }

  const total =
    tipo === "entrada" ? stockActual + cantidad : stockActual - cantidad;
  const expresion =
    tipo === "entrada"
      ? `${cantidad} + ${stockActual} = ${total}`
      : `${stockActual} - ${cantidad} = ${total}`;

  return `${base} (${expresion})`;
};

export const obtenerStockActual = (
  stockMap: StockBultosMap,
  materialId: string,
): number | null => {
  const value = stockMap.get(materialId);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export const actualizarStockMap = (
  stockMap: StockBultosMap,
  materialId: string,
  tipo: "entrada" | "salida",
  cantidad: number | null,
) => {
  if (cantidad === null || !Number.isFinite(cantidad)) return;
  const stockActual = obtenerStockActual(stockMap, materialId);
  if (stockActual === null) return;
  const nuevoStock =
    tipo === "entrada" ? stockActual + cantidad : stockActual - cantidad;
  stockMap.set(materialId, nuevoStock);
};
