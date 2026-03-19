import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type React from "react";
import { useState } from "react";

import { parseFotoUrls } from "../_utils/fotos";
import type { InventarioSnapshot, MovimientoInventario } from "../types";

function formatMovimientoFecha(movimiento: MovimientoInventario) {
  let fechaBase = movimiento.created_at || movimiento.fecha;

  if (!fechaBase) return "—";

  // ¿La fecha viene sin hora?
  const tieneHora = fechaBase.includes("T");

  if (!tieneHora) {
    const ahora = new Date();
    const horaLocal = ahora.toTimeString().split(" ")[0]; // HH:MM:SS local
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

function formatSnapshotFecha(fecha: string | null) {
  if (!fecha) return "—";
  const fechaBase = fecha.includes("T") ? fecha : `${fecha}T00:00:00`;
  const parsed = new Date(fechaBase);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("es-CO", {
    dateStyle: "medium",
  });
}

type HistorialDialogProps = {
  open: boolean;
  materialId: string | null;
  materialNombre: string;
  movimientos: MovimientoInventario[];
  snapshots: InventarioSnapshot[];
  snapshotDate: string;
  snapshotError: string | null;
  snapshotLoading: boolean;
  onSnapshotDateChange: (value: string) => void;
  onClose: () => void;
  editableRefTipos?: string[];
  onUpdateNotas?: (movimientoId: string, notas: string) => Promise<boolean>;
};

export function HistorialDialog({
  open,
  materialId,
  materialNombre,
  movimientos,
  snapshots,
  snapshotDate,
  snapshotError,
  snapshotLoading,
  onSnapshotDateChange,
  onClose,
  editableRefTipos = [],
  onUpdateNotas,
}: HistorialDialogProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState("center center");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNotas, setEditingNotas] = useState<string>("");
  const [savingNotas, setSavingNotas] = useState(false);
  const [activeTab, setActiveTab] = useState("movimientos");
  const snapshotsFiltrados = materialId
    ? snapshots.filter((snapshot) => snapshot.material_id === materialId)
    : snapshots;
  const sortedMovimientos = [...movimientos].sort((a, b) => {
    const fechaA = getMovimientoFecha(a);
    const fechaB = getMovimientoFecha(b);

    if (fechaA && fechaB) return fechaB.getTime() - fechaA.getTime();
    if (fechaA) return -1;
    if (fechaB) return 1;
    return 0;
  });
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Historial de movimientos</DialogTitle>
          <DialogDescription>
            {materialNombre
              ? `Movimientos registrados para ${materialNombre}.`
              : "Revisa los movimientos mas recientes del inventario."}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
            <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
          </TabsList>
          <TabsContent value="movimientos">
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
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
                  {movimientos.length ? (
                    sortedMovimientos.map((movimiento, index) => {
                      const movimientoId =
                        movimiento.id ?? `${movimiento.created_at}-${index}`;
                      const fotos = parseFotoUrls(movimiento.foto_url);
                      // "*" significa que todos los tipos son editables
                      const allEditable = editableRefTipos.includes("*");
                      const editable =
                        (allEditable ||
                          editableRefTipos.includes(
                            movimiento.ref_tipo ?? "",
                          )) &&
                        Boolean(onUpdateNotas) &&
                        Boolean(movimiento.id);

                      return (
                        <TableRow key={movimientoId}>
                          <TableCell className="text-sm text-muted-foreground">
                            <div className="flex flex-col">
                              <span>{formatMovimientoFecha(movimiento)}</span>
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
                                  onChange={(event) =>
                                    setEditingNotas(event.target.value)
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
                                        editingNotas,
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
                                <span>{movimiento.notas ?? "sin notas"}</span>
                                {editable ? (
                                  <Button
                                    variant="link"
                                    className="h-auto p-0 text-xs"
                                    onClick={() => {
                                      setEditingId(movimiento.id ?? null);
                                      setEditingNotas(movimiento.notas ?? "");
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
          </TabsContent>
          <TabsContent value="snapshots">
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="snapshot-date"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Fecha del snapshot
                  </label>
                  <input
                    id="snapshot-date"
                    type="date"
                    value={snapshotDate}
                    onChange={(event) =>
                      onSnapshotDateChange(event.target.value)
                    }
                    className="w-48 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  />
                </div>
                {snapshotDate ? (
                  <Button
                    variant="ghost"
                    onClick={() => onSnapshotDateChange("")}
                  >
                    Limpiar fecha
                  </Button>
                ) : null}
              </div>
              {snapshotLoading ? (
                <p className="text-sm text-muted-foreground">
                  Cargando snapshots...
                </p>
              ) : snapshotError ? (
                <p className="text-sm text-rose-600">{snapshotError}</p>
              ) : (
                <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Fecha</TableHead>
                        <TableHead className="font-semibold">Bultos</TableHead>
                        <TableHead className="font-semibold">Kg</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshotsFiltrados.length ? (
                        snapshotsFiltrados.map((snapshot) => (
                          <TableRow
                            key={
                              snapshot.id ??
                              `${snapshot.fecha}-${snapshot.material_id}`
                            }
                          >
                            <TableCell className="text-sm text-muted-foreground">
                              {formatSnapshotFecha(snapshot.fecha)}
                            </TableCell>
                            <TableCell>{snapshot.bultos ?? "-"}</TableCell>
                            <TableCell>{snapshot.kg ?? "-"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="py-12 text-center text-sm text-muted-foreground"
                          >
                            No hay snapshots disponibles para este material.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
      <Dialog
        open={Boolean(selectedPhoto)}
        onOpenChange={(value) => {
          if (!value) {
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
