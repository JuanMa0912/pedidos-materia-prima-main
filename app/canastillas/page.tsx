"use client";

import React, { useState } from "react";
import { InventoryEntry } from "@/app/canastillas/InventoryEntry";
import { SignaturePad } from "@/app/canastillas/SignaturePad";
import { SuccessView } from "@/app/canastillas/SuccessView";
import {
  CanastillaFormValues,
  EntryMode,
  InventoryItem,
} from "@/app/canastillas/types";
import { ChevronRight } from "lucide-react";

enum Step {
  MENU = 0,
  ENTRY = 1,
  SIGNATURE = 2,
  SUCCESS = 3,
}

const getTodayDate = () => new Date().toISOString().slice(0, 10);

export default function CrateFlowPage() {
  const [currentStep, setCurrentStep] = useState<Step>(Step.MENU);
  const [entryMode, setEntryMode] = useState<EntryMode>("ingreso");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [signature, setSignature] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<CanastillaFormValues>({
    fecha: getTodayDate(),
    consecutivo: "",
    placaVH: "",
    nombreCliente: "",
    nombreAutoriza: "",
  });

  const resetFlow = (mode: EntryMode = entryMode) => {
    setCurrentStep(Step.ENTRY);
    setItems([]);
    setNotes("");
    setSignature("");
    setFormValues({
      fecha: getTodayDate(),
      consecutivo: "",
      placaVH: "",
      nombreCliente: "",
      nombreAutoriza: "",
    });
    setSaveError(null);
    setIsSaving(false);
    setEntryMode(mode);
  };

  const returnToMenu = () => {
    setCurrentStep(Step.MENU);
    setItems([]);
    setNotes("");
    setSignature("");
    setFormValues({
      fecha: getTodayDate(),
      consecutivo: "",
      placaVH: "",
      nombreCliente: "",
      nombreAutoriza: "",
    });
    setSaveError(null);
    setIsSaving(false);
  };

  const handleAddItem = (item: InventoryItem) => {
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (existing) =>
          existing.type === item.type && existing.provider === item.provider,
      );
      if (existingIndex === -1) {
        return [...prevItems, item];
      }
      const updatedItems = [...prevItems];
      const existingItem = updatedItems[existingIndex];
      updatedItems[existingIndex] = {
        ...existingItem,
        quantity: existingItem.quantity + item.quantity,
      };
      return updatedItems;
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, patch: Partial<InventoryItem>) => {
    setItems((prevItems) => {
      const itemIndex = prevItems.findIndex((item) => item.id === id);
      if (itemIndex === -1) return prevItems;
      const updatedItems = [...prevItems];
      const updatedItem = {
        ...updatedItems[itemIndex],
        ...patch,
        quantity: Math.max(
          1,
          patch.quantity ?? updatedItems[itemIndex].quantity,
        ),
      };
      updatedItems[itemIndex] = updatedItem;
      const duplicateIndex = updatedItems.findIndex(
        (item, index) =>
          index !== itemIndex &&
          item.type === updatedItem.type &&
          item.provider === updatedItem.provider,
      );
      if (duplicateIndex === -1) return updatedItems;
      const duplicateItem = updatedItems[duplicateIndex];
      const mergedItem = {
        ...duplicateItem,
        quantity: duplicateItem.quantity + updatedItem.quantity,
      };
      const firstIndex = Math.min(itemIndex, duplicateIndex);
      const nextItems = updatedItems.filter(
        (_, index) => index !== itemIndex && index !== duplicateIndex,
      );
      nextItems.splice(firstIndex, 0, mergedItem);
      return nextItems;
    });
  };

  const handleReset = () => {
    returnToMenu();
  };

  const isEntryFormComplete =
    formValues.consecutivo.trim().length > 0 &&
    formValues.placaVH.trim().length === 6 &&
    formValues.nombreCliente.trim().length > 0 &&
    formValues.nombreAutoriza.trim().length > 0;
  const canProceedFromEntry = items.length > 0 && isEntryFormComplete;

  const missingFields = [
    items.length === 0 ? "agrega al menos una canastilla" : null,
    formValues.consecutivo.trim().length === 0
      ? "ingresa el consecutivo"
      : null,
    formValues.placaVH.trim().length !== 6
      ? "completa la placa VH (6 caracteres)"
      : null,
    formValues.nombreCliente.trim().length === 0
      ? "ingresa el nombre del cliente"
      : null,
    formValues.nombreAutoriza.trim().length === 0
      ? "ingresa el nombre de quien autoriza"
      : null,
  ].filter((value): value is string => Boolean(value));

  const handleSaveSignature = async (dataUrl: string) => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const observaciones = notes.trim();
    const normalizedSignature = dataUrl.includes(",")
      ? dataUrl.split(",")[1]
      : dataUrl;
    const response = await fetch("/api/canastillas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consecutivo: formValues.consecutivo,
        fecha: formValues.fecha,
        placa_vh: formValues.placaVH,
        nombre_cliente: formValues.nombreCliente,
        nombre_autoriza: formValues.nombreAutoriza,
        observaciones: observaciones || null,
        entryMode,
        firma: normalizedSignature,
        items: items.map((item) => ({
          tipo_canastilla: item.type,
          proveedor: item.provider,
          cantidad: item.quantity,
        })),
      }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      const detail = result.error?.trim();
      setSaveError(
        detail
          ? `No se pudo guardar el registro: ${detail}`
          : "No se pudo guardar el registro. Verifica la conexión y vuelve a intentar.",
      );
      setIsSaving(false);
      return;
    }

    setSignature(dataUrl);
    setCurrentStep(Step.SUCCESS);
    setIsSaving(false);
  };

  const progressStepIndex =
    currentStep === Step.ENTRY
      ? 0
      : currentStep === Step.SIGNATURE
        ? 1
        : currentStep === Step.SUCCESS
          ? 2
          : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 print:min-h-0 print:bg-white">
      <div className="container mx-auto max-w-2xl px-4 py-8 print:px-0 print:py-0">
        {currentStep !== Step.MENU && (
          <div className="mb-6 flex flex-col gap-3 print:hidden">
            <button
              type="button"
              onClick={returnToMenu}
              className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Volver al menú
            </button>
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm">
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a
                  href="/canastillas/proveedores"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 sm:px-4 sm:py-2 sm:text-sm"
                >
                  Gestionar proveedores
                </a>
                <a
                  href="/canastillas/inventario"
                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50 sm:px-4 sm:py-2 sm:text-sm"
                >
                  Ver inventario
                </a>
              </div>
            </div>
          </div>
        )}

        {currentStep === Step.MENU && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-black text-slate-900">
                ¿Qué deseas registrar?
              </h1>
              <p className="text-slate-500 mt-1">
                Elige el tipo de movimiento para continuar con el formulario.
              </p>
            </div>
            <div className="grid gap-4">
              <button
                type="button"
                onClick={() => {
                  setEntryMode("devolucion");
                  resetFlow("devolucion");
                }}
                className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Devolución de canastillas
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Registra la entrega de canastillas que se devuelven.
                    </p>
                  </div>
                  <ChevronRight className="text-blue-600" />
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryMode("ingreso");
                  resetFlow("ingreso");
                }}
                className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Préstamo de canastillas
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Registra las canastillas que entran en forma de préstamo.
                    </p>
                  </div>
                  <ChevronRight className="text-blue-600" />
                </div>
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
              <a
                href="/canastillas/proveedores"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Gestionar proveedores
              </a>
              <a
                href="/canastillas/inventario"
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
              >
                Ver inventario
              </a>
            </div>
          </div>
        )}
        {/* Progress Indicator */}
        {currentStep !== Step.MENU && (
          <div className="mb-8 print:hidden">
            <div className="flex items-center justify-between mb-3">
              {["Registro", "Firma", "Completado"].map((label, idx) => (
                <div key={idx} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                      idx === progressStepIndex
                        ? "bg-blue-600 text-white scale-110 shadow-lg shadow-blue-200"
                        : idx < progressStepIndex
                          ? "bg-green-500 text-white"
                          : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {idx < progressStepIndex ? "✓" : idx + 1}
                  </div>
                  <span
                    className={`text-xs mt-2 font-semibold ${
                      idx === progressStepIndex
                        ? "text-blue-600"
                        : "text-slate-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${(progressStepIndex / 2) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Step Content */}
        {currentStep === Step.ENTRY && (
          <InventoryEntry
            entryMode={entryMode}
            items={items}
            formValues={formValues}
            notes={notes}
            onNotesChange={setNotes}
            onFormChange={setFormValues}
            onAddItem={handleAddItem}
            onRemoveItem={handleRemoveItem}
            onUpdateItem={handleUpdateItem}
          />
        )}

        {currentStep === Step.SIGNATURE && (
          <SignaturePad
            onSave={handleSaveSignature}
            onBack={() => setCurrentStep(Step.ENTRY)}
            isSaving={isSaving}
            errorMessage={saveError}
          />
        )}

        {currentStep === Step.SUCCESS && (
          <SuccessView
            entryMode={entryMode}
            items={items}
            signature={signature}
            formValues={formValues}
            notes={notes}
            onReset={handleReset}
          />
        )}

        {/* Navigation Buttons (except for signature and success steps) */}
        {currentStep !== Step.MENU &&
          currentStep !== Step.SIGNATURE &&
          currentStep !== Step.SUCCESS && (
            <div className="mt-8 grid gap-3">
              {currentStep === Step.ENTRY && (
                <div className="space-y-2">
                  <button
                    onClick={() => setCurrentStep(Step.SIGNATURE)}
                    disabled={!canProceedFromEntry}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                      canProceedFromEntry
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    }`}
                  >
                    Continuar a Firma <ChevronRight size={20} />
                  </button>
                  {!canProceedFromEntry && missingFields.length > 0 && (
                    <p className="text-xs text-slate-500">
                      Para continuar,{" "}
                      <span className="font-semibold text-slate-600">
                        {missingFields.join(", ")}
                      </span>
                      .
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
