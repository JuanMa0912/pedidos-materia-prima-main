import { Button } from "@/components/ui/button";
import {
  History,
  PackageMinus,
  PencilLine,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtNum } from "@/lib/format";

import { formatUnidad, obtenerEtiquetaCobertura } from "../utils";
import type { StockRow } from "../types";

type InventarioTableProps = {
  rows: StockRow[];
  loading: boolean;
  mostrarColumnaKg: boolean;
  onVerHistorial: (materialId: string, nombre: string) => void;
  onEditar: (
    materialId: string,
    nombre: string,
    stockBultos: number,
    unidad: StockRow["unidad"]
  ) => void;
  onConsumo: (
    materialId: string,
    nombre: string,
    unidad: StockRow["unidad"]
  ) => void;
  onDeshacerConsumo: (materialId: string) => void;
  onDeshacerPedido: (materialId: string, nombre: string) => void;
  deshaciendoPedidoMaterialId: string | null;
};

const FECHA_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
});

function formatFechaHasta(fecha: string) {
  const [year, month, day] = fecha.split("-").map(Number);
  if (!year || !month || !day) return fecha;
  const date = new Date(Date.UTC(year, month - 1, day));
  return FECHA_FORMATTER.format(date);
}

export function InventarioTable({
  rows,
  loading,
  mostrarColumnaKg,
  onVerHistorial,
  onEditar,
  onConsumo,
  onDeshacerConsumo,
  onDeshacerPedido,
  deshaciendoPedidoMaterialId,
}: InventarioTableProps) {
  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, index) => (
      <TableRow key={`skeleton-${index}`}>
        <TableCell>
          <Skeleton className="h-5 w-40 bg-slate-200" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-5 w-32 bg-slate-200" />
        </TableCell>
        {mostrarColumnaKg && (
          <TableCell>
            <Skeleton className="h-5 w-24 bg-slate-200" />
          </TableCell>
        )}
        <TableCell>
          <Skeleton className="h-5 w-24 bg-slate-200" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-5 w-24 bg-slate-200" />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Skeleton className="h-8 w-20 bg-slate-200" />
            <Skeleton className="h-8 w-20 bg-slate-200" />
            <Skeleton className="h-8 w-20 bg-slate-200" />
          </div>
        </TableCell>
      </TableRow>
    ));

  return (
    <Table className="min-w-7-[760px] text-sm">
      <TableHeader>
        <TableRow className="bg-slate-50">
          <TableHead className="font-semibold text-center">Material</TableHead>
          <TableHead className="font-semibold text-center">Stock</TableHead>
          {mostrarColumnaKg && (
            <TableHead className="font-semibold text-center">
              Stock (kg)
            </TableHead>
          )}
          <TableHead className="font-semibold text-center">
            Cobertura estimada
          </TableHead>
          <TableHead className="font-semibold text-center">Estado</TableHead>
          <TableHead className="text-center font-semibold">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          renderSkeletonRows()
        ) : rows.length ? (
          rows.map((row) => {
            const esAguja = row.nombre.toLowerCase().includes("aguja");
            const { estilo, texto } = obtenerEtiquetaCobertura(row.cobertura);
            return (
              <TableRow className="text-center" key={row.material_id}>
                <TableCell className="font-medium">{row.nombre}</TableCell>
                <TableCell>{formatUnidad(row.stock, row.unidad)}</TableCell>
                {mostrarColumnaKg && (
                  <TableCell>
                    {row.unidad === "unidad"
                      ? "—"
                      : `${fmtNum(row.stockKg)} kg`}
                  </TableCell>
                )}
                <TableCell className="text-sm text-muted-foreground">
                  {esAguja
                    ? "—"
                    : (() => {
                        const hasta = row.hasta;
                        if (!hasta) {
                          return "Sin estimación";
                        }

                        const isoDate = hasta.includes("T")
                          ? hasta.split("T")[0] ?? hasta
                          : hasta;

                        return `Hasta ${formatFechaHasta(isoDate)}`;
                      })()}
                </TableCell>

                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${estilo}`}
                  >
                    {texto}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <div className="flex w-full max-w-2xl items-center justify-end gap-2 overflow-x-auto pb-1">
                      <div className="flex flex-nowrap items-center justify-end gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-1.5 py-1 shadow-sm backdrop-blur-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                          onClick={() =>
                            onVerHistorial(row.material_id, row.nombre)
                          }
                        >
                          <History className="size-4" />
                          Historial
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg px-2.5 text-xs font-medium text-[#1F4F9C] transition-colors hover:bg-[#1F4F9C]/10 hover:text-[#163a73]"
                          onClick={() =>
                            onEditar(
                              row.material_id,
                              row.nombre,
                              row.stock,
                              row.unidad
                            )
                          }
                        >
                          <PencilLine className="size-4" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg bg-gradient-to-r from-[#1F4F9C] via-[#256fa8] to-[#29B8A6] px-2.5 text-xs font-semibold text-white shadow-sm transition-[background,box-shadow] hover:from-[#19427b] hover:via-[#1f5d8d] hover:to-[#229684] hover:shadow-md"
                          onClick={() =>
                            onConsumo(row.material_id, row.nombre, row.unidad)
                          }
                        >
                          <PackageMinus className="size-4" />
                          Consumo manual
                        </Button>
                      </div>

                      <div className="flex flex-nowrap items-center justify-end gap-1.5 rounded-xl border border-red-200/80 bg-red-50/90 px-1.5 py-1 shadow-sm backdrop-blur-sm">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-lg px-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
                          onClick={() => onDeshacerConsumo(row.material_id)}
                        >
                          <RotateCcw className="size-4" />
                          Deshacer consumo
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-lg px-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 disabled:text-red-400"
                          disabled={
                            deshaciendoPedidoMaterialId === row.material_id
                          }
                          onClick={() =>
                            onDeshacerPedido(row.material_id, row.nombre)
                          }
                        >
                          <Undo2 className="size-4" />
                          {deshaciendoPedidoMaterialId === row.material_id
                            ? "Deshaciendo..."
                            : "Deshacer pedido"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell
              colSpan={mostrarColumnaKg ? 6 : 5}
              className="py-12 text-center text-sm text-muted-foreground"
            >
              No hay materiales registrados para esta zona.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
