export const round4 = (n: number) => Math.round(n * 1e4) / 1e4; // guardamos con 4 decimales
export const show2 = (n: number) =>
  new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
