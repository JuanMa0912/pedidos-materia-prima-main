import type { ChangeEvent } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { MaterialConsumo } from "../types";

type ConsumoManualAgujasDialogProps = {
  open: boolean;
  material: MaterialConsumo;
  value: string;
  selectedDay: string;
  notesValue: string;
  notesLabel?: string;
  notesPlaceholder?: string;
  photoNames?: string[];
  photoError?: string | null;
  onClose: () => void;
  onChange: (value: string) => void;
  onDayChange: (day: string) => void;
  onNotesChange: (notes: string) => void;
  onPhotosChange?: (files: File[] | null) => void;
  onSubmit: () => void;
  submitting?: boolean;
};

export function ConsumoManualAgujasDialog({
  open,
  material,
  value,
  selectedDay,
  notesValue,
  notesLabel,
  notesPlaceholder,
  photoNames,
  photoError,
  onClose,
  onChange,
  onDayChange,
  onNotesChange,
  onPhotosChange,
  onSubmit,
  submitting = false,
}: ConsumoManualAgujasDialogProps) {
  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const hoy = new Date();
  const indiceHoyNormalizado = Math.min(
    (hoy.getDay() + 6) % 7,
    dias.length - 1
  );
  const diasDisponibles = dias.filter(
    (_, index) => index <= indiceHoyNormalizado
  );

  const handleValueChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handleNotesChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onNotesChange(event.target.value);
  };

  const handlePhotosChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    const files = fileList ? Array.from(fileList) : null;
    onPhotosChange?.(files);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar consumo manual</DialogTitle>
          <DialogDescription>
            Indica el consumo realizado de {material.nombre}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            ¿Cuanto fue el consumo de hoy? ({material.unidad}
            {material.unidad !== "unidad" ? "s" : ""})
          </label>
          <Input
            type="number"
            value={value}
            onChange={handleValueChange}
            placeholder={`Ingrese cantidad en ${material.unidad}${
              material.unidad !== "unidad" ? "s" : ""
            }`}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Selecciona el día del proceso
          </label>
          <div className="flex flex-wrap gap-2">
            {diasDisponibles.map((dia) => (
              <Button
                key={dia}
                type="button"
                variant={dia === selectedDay ? "default" : "outline"}
                className={`min-w-[110px] border transition focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${
                  dia === selectedDay
                    ? "border-primary bg-primary/10 text-primary"
                    : ""
                }`}
                onClick={() => onDayChange(dia)}
              >
                {dia}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            {notesLabel ?? "Notas"}
          </label>
          <Textarea
            value={notesValue}
            onChange={handleNotesChange}
            placeholder={notesPlaceholder ?? "Agregar notas u observaciones"}
          />
        </div>

        {onPhotosChange ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foregrounds">
              Fotos del consumo (hasta 3, opcional)
            </label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotosChange}
            />
            {photoNames && photoNames.length ? (
              <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {photoNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : null}
            {photoError ? (
              <p className="text-sm text-destructive">{photoError}</p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
