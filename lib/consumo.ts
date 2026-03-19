export type UnidadMedida = "bulto" | "unidad" | "litro";

export type MaterialConsumoLike = {
  nombre?: string | null;
  unidad_medida?: UnidadMedida | null;
  presentacion_kg_por_bulto?: number | null;
  tasa_consumo_diaria_kg?: number | null;
};

export const HARINA_CONSUMO_BULTOS_DIARIO = 12;

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function calcularConsumoDiarioKg(
  material: MaterialConsumoLike
): number | null {
  const consumoConfigurado = material.tasa_consumo_diaria_kg;
  if (isPositiveNumber(consumoConfigurado)) {
    if (
      material.unidad_medida === "bulto" &&
      isPositiveNumber(material.presentacion_kg_por_bulto)
    ) {
      return consumoConfigurado * material.presentacion_kg_por_bulto;
    }

    return consumoConfigurado;
  }

  const nombre = material.nombre?.toLowerCase() ?? "";
  const esHarina = nombre.includes("harina");
  const esBulto = material.unidad_medida === "bulto";
  const presentacion = material.presentacion_kg_por_bulto;

  if (esHarina && esBulto && isPositiveNumber(presentacion)) {
    return HARINA_CONSUMO_BULTOS_DIARIO * presentacion;
  }

  return null;
}
