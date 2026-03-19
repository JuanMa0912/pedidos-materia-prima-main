import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  PackageMinus,
  PencilLine,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { fmtNum } from "@/lib/format";

import { parseFotoUrls } from "../_utils/fotos";
import { formatUnidad, obtenerEtiquetaCobertura } from "../utils";
import type { MovimientoInventario, StockRow } from "../types";

type MaterialAccionesDialogProps = {
  open: boolean;
  material: StockRow | null;
  zonaNombre: string;
  movimientos: MovimientoInventario[];
  onUpdateNotas?: (movimientoId: string, notas: string) => Promise<boolean>;
  onClose: () => void;
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

function formatMovimientoFecha(movimiento: MovimientoInventario) {
  let fechaBase = movimiento.created_at || movimiento.fecha;
  if (!fechaBase) return "—";

  if (!fechaBase.includes("T")) {
    const ahora = new Date();
    const horaLocal = ahora.toTimeString().split(" ")[0];
    fechaBase = `${fechaBase}T${horaLocal}`;
  }

  const fecha = new Date(fechaBase);
  if (Number.isNaN(fecha.getTime())) return "—";

  return fecha.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getMovimientoFecha(movimiento: MovimientoInventario) {
  let fechaBase = movimiento.created_at || movimiento.fecha;
  if (!fechaBase) return null;

  if (!fechaBase.includes("T")) {
    const ahora = new Date();
    const horaLocal = ahora.toTimeString().split(" ")[0];
    fechaBase = `${fechaBase}T${horaLocal}`;
  }

  const fecha = new Date(fechaBase);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function MaterialAccionesDialog({
  open,
  material,
  zonaNombre,
  movimientos,
  onUpdateNotas,
  onClose,
  onEditar,
  onConsumo,
  onDeshacerConsumo,
  onDeshacerPedido,
  deshaciendoPedidoMaterialId,
}: MaterialAccionesDialogProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState("center center");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNotas, setEditingNotas] = useState("");
  const [savingNotas, setSavingNotas] = useState(false);

  if (!material) return null;

  const { estilo, texto } = obtenerEtiquetaCobertura(material.cobertura);
  const esAguja = material.nombre.toLowerCase().includes("aguja");

  const coberturaTexto = esAguja
    ? "—"
    : material.hasta
      ? `Hasta ${formatFechaHasta(material.hasta.includes("T") ? material.hasta.split("T")[0] ?? material.hasta : material.hasta)}`
      : "Sin estimación";

  const handleAction = (action: () => void) => {
    onClose();
    action();
  };

  const sortedMovimientos = [...movimientos].sort((a, b) => {
    const fechaA = getMovimientoFecha(a);
    const fechaB = getMovimientoFecha(b);
    if (fechaA && fechaB) return fechaB.getTime() - fechaA.getTime();
    if (fechaA) return -1;
    if (fechaB) return 1;
    return 0;
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {material.nombre}
            <span className="text-sm font-normal text-muted-foreground">
              — {zonaNombre}
            </span>
          </DialogTitle>
          <DialogDescription>
            Detalle, historial y acciones del material.
          </DialogDescription>
        </DialogHeader>

        {/* Info card */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-slate-50/50 p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Stock
            </p>
            <p className="text-sm font-semibold text-slate-800">
              {formatUnidad(material.stock, material.unidad)}
            </p>
          </div>
          {material.unidad !== "unidad" && material.stockKg > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Stock (kg)
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {fmtNum(material.stockKg)} kg
              </p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Cobertura
            </p>
            <p className="text-sm text-slate-700">{coberturaTexto}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Estado
            </p>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilo}`}
            >
              {texto}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-10 gap-2 bg-gradient-to-r from-[#1F4F9C] via-[#256fa8] to-[#29B8A6] text-sm font-semibold text-white shadow-sm hover:from-[#19427b] hover:via-[#1f5d8d] hover:to-[#229684]"
            onClick={() =>
              handleAction(() =>
                onConsumo(
                  material.material_id,
                  material.nombre,
                  material.unidad
                )
              )
            }
          >
            <PackageMinus className="size-4" />
            Consumo manual
          </Button>
          <Button
            variant="outline"
            className="h-10 gap-2 text-sm text-[#1F4F9C] hover:bg-[#1F4F9C]/10 hover:text-[#163a73]"
            onClick={() =>
              handleAction(() =>
                onEditar(
                  material.material_id,
                  material.nombre,
                  material.stock,
                  material.unidad
                )
              )
            }
          >
            <PencilLine className="size-4" />
            Editar stock
          </Button>
          <Button
            variant="outline"
            className="h-10 gap-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() =>
              handleAction(() => onDeshacerConsumo(material.material_id))
            }
          >
            <RotateCcw className="size-4" />
            Deshacer consumo
          </Button>
          <Button
            variant="outline"
            className="h-10 gap-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 disabled:text-red-400"
            disabled={deshaciendoPedidoMaterialId === material.material_id}
            onClick={() =>
              handleAction(() =>
                onDeshacerPedido(material.material_id, material.nombre)
              )
            }
          >
            <Undo2 className="size-4" />
            {deshaciendoPedidoMaterialId === material.material_id
              ? "Deshaciendo..."
              : "Deshacer pedido"}
          </Button>
        </div>

        {/* Historial - movimientos only */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            Historial de movimientos
          </h3>
          <div className="max-h-[40vh] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">Fecha</TableHead>
                  <TableHead className="font-semibold">Tipo</TableHead>
                  <TableHead className="font-semibold">Bultos</TableHead>
                  <TableHead className="font-semibold">Kg</TableHead>
                  <TableHead className="font-semibold">Notas</TableHead>
                  <TableHead className="font-semibold">Fotos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMovimientos.length ? (
                  sortedMovimientos.map((movimiento, index) => {
                    const movimientoId =
                      movimiento.id ?? `${movimiento.created_at}-${index}`;
                    const fotos = parseFotoUrls(movimiento.foto_url);
                    const editable =
                      Boolean(onUpdateNotas) && Boolean(movimiento.id);

                    return (
                      <TableRow key={movimientoId}>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex flex-col">
                            <span>
                              {formatMovimientoFecha(movimiento)}
                            </span>
                            {movimiento.dia_proceso ? (
                              <span className="text-xs">
                                Día proceso:{" "}
                                <strong style={{ color: "black" }}>
                                  {movimiento.dia_proceso}
                                </strong>
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {movimiento.tipo}
                        </TableCell>
                        <TableCell>{movimiento.bultos ?? "-"}</TableCell>
                        <TableCell>{movimiento.kg ?? "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {editingId === movimiento.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingNotas}
                                onChange={(e) =>
                                  setEditingNotas(e.target.value)
                                }
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditingNotas("");
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    if (!movimiento.id || !onUpdateNotas)
                                      return;
                                    setSavingNotas(true);
                                    const ok = await onUpdateNotas(
                                      movimiento.id,
                                      editingNotas
                                    );
                                    if (ok) {
                                      setEditingId(null);
                                      setEditingNotas("");
                                    }
                                    setSavingNotas(false);
                                  }}
                                  disabled={savingNotas}
                                >
                                  {savingNotas ? "Guardando..." : "Guardar"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <span>
                                {movimiento.notas ?? "sin notas"}
                              </span>
                              {editable ? (
                                <Button
                                  variant="link"
                                  className="h-auto p-0 text-xs"
                                  onClick={() => {
                                    setEditingId(movimiento.id ?? null);
                                    setEditingNotas(
                                      movimiento.notas ?? ""
                                    );
                                  }}
                                >
                                  Editar nota
                                </Button>
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {fotos.length ? (
                            <div className="flex flex-wrap gap-2">
                              {fotos.map((foto, fotoIndex) => (
                                <Button
                                  key={`${movimientoId}-foto-${fotoIndex}`}
                                  variant="link"
                                  className="px-0 text-sm"
                                  onClick={() => {
                                    setIsZoomed(false);
                                    setTransformOrigin("center center");
                                    setSelectedPhoto(foto);
                                  }}
                                >
                                  Ver foto{" "}
                                  {fotos.length > 1 ? fotoIndex + 1 : ""}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              -
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No hay movimientos registrados para este material
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>

      {/* Photo zoom dialog */}
      <Dialog
        open={Boolean(selectedPhoto)}
        onOpenChange={(v) => {
          if (!v) {
            setSelectedPhoto(null);
            setIsZoomed(false);
            setTransformOrigin("center center");
          }
        }}
      >
        <DialogContent className="max-w-5xl w-full">
          <DialogHeader>
            <DialogTitle>Foto del movimiento</DialogTitle>
            <DialogDescription>
              Vista previa ampliada de la foto asociada a este movimiento.
            </DialogDescription>
          </DialogHeader>
          {selectedPhoto ? (
            <div className="flex justify-center max-h-[85vh] overflow-auto">
              <img
                src={selectedPhoto}
                alt="Foto del movimiento"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const offsetX =
                    ((event.clientX - rect.left) / rect.height) * 100;
                  const offsetY =
                    ((event.clientY - rect.top) / rect.height) * 100;

                  if (isZoomed) {
                    setIsZoomed(false);
                  } else {
                    setTransformOrigin(`${offsetX}% ${offsetY}%`);
                    setIsZoomed(true);
                  }
                }}
                style={{
                  transform: isZoomed ? "scale(2)" : "scale(1)",
                  transformOrigin,
                }}
                className={`w-full object-contain rounded-lg shadow-md transition-transform duration-300 ${
                  isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
                }`}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
