import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getLocalDateISO(date: Date = new Date()) {
  const offsetInMs = date.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(date.getTime() - offsetInMs);
  return localDate.toISOString().slice(0, 10);
}

const DOMINGO = 0;
const SABADO = 6;

/**
 * Suma una cantidad de días evitando contar los domingos.
 * La fecha resultante siempre cae en un día hábil (lunes a viernes).
 */
export function sumarDiasSinDomingos(fechaInicio: Date, dias: number): Date {
  const resultado = new Date(fechaInicio);
  resultado.setHours(0, 0, 0, 0);

  while (resultado.getDay() === DOMINGO || resultado.getDay() === SABADO) {
    resultado.setDate(resultado.getDate() - 1);
  }

  let restantes = Math.max(0, Math.floor(dias));

  while (restantes > 0) {
    resultado.setDate(resultado.getDate() + 1);
    if (resultado.getDay() === DOMINGO) {
      continue;
    }
    restantes -= 1;
  }

  if (resultado.getDay() === DOMINGO) {
    resultado.setDate(resultado.getDate() + 1);
  }

  return resultado;
}

type CalcularFechaCoberturaOptions = {
  coberturaDias: number;
  fechaInicio?: Date;
  diasExtra?: number;
};

/**
 * Calcula la fecha de cobertura sumando los días estimados y días extra,
 * sin contar los domingos en el proceso y ajustando la fecha final
 * al día hábil anterior si cae en fin de semana.
 */
export function calcularFechaCobertura({
  coberturaDias,
  fechaInicio = new Date(),
  diasExtra = 0,
}: CalcularFechaCoberturaOptions): Date {
  const diasRestantes = Math.max(0, Math.floor(coberturaDias));

  const diasTotales = diasRestantes + Math.max(0, Math.floor(diasExtra));

  return sumarDiasSinDomingos(fechaInicio, diasTotales);
}
