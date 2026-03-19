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

import type { MaterialEditar } from "../types";

type EditarInventarioDialogProps = {
  open: boolean;
  material: MaterialEditar;
  onClose: () => void;
  onChange: (value: number) => void;
  onSubmit: () => void;
};

export function EditarInventarioDialog({
  open,
  material,
  onClose,
  onChange,
  onSubmit,
}: EditarInventarioDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar inventario</DialogTitle>
          <DialogDescription>
            ajusta manualmente el stock disponible para {material.nombre}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Nuevo stock (bultos)
          </label>
          <Input
            type="number"
            value={
              Number.isFinite(material.stockBultos) ? material.stockBultos : 0
            }
            onChange={(event) => onChange(parseFloat(event.target.value) || 0)}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSubmit}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
