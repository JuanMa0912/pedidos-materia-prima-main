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

import type { MaterialConsumo } from "../types";

type ConsumoManualSalmueraDialogProps = {
  open: boolean;
  material: MaterialConsumo;
  value: string;
  selectedDay: string;
  disabledDays?: string[];
  onClose: () => void;
  onChange: (value: string) => void;
  onDayChange: (day: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
};

export function ConsumoManualSalmueraDialog({
  open,
  material,
  value,
  selectedDay,
  disabledDays = [],
  onClose,
  onChange,
  onDayChange,
  onSubmit,
  submitting = false,
}: ConsumoManualSalmueraDialogProps) {
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
            {diasDisponibles.map((dia) => {
              const estaDeshabilitado = disabledDays.includes(dia);
              return (
                <Button
                  key={dia}
                  type="button"
                  variant={dia === selectedDay ? "default" : "outline"}
                  className={`min-w-[110px] border transition focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${
                    dia === selectedDay
                      ? "border-primary bg-primary/10 text-primary"
                      : ""
                  }`}
                  disabled={estaDeshabilitado}
                  onClick={() => onDayChange(dia)}
                >
                  {dia}
                </Button>
              );
            })}
          </div>
        </div>

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
