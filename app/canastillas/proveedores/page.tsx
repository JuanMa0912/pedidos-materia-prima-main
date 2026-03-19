"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Save, Trash2, Truck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Provider = {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  notas: string | null;
  activo: boolean | null;
};

const defaultFormState = {
  nombre: "",
  contacto: "",
  telefono: "",
  notas: "",
  activo: true,
};

export default function CrateSuppliersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState(defaultFormState.nombre);
  const [contacto, setContacto] = useState(defaultFormState.contacto);
  const [telefono, setTelefono] = useState(defaultFormState.telefono);
  const [notas, setNotas] = useState(defaultFormState.notas);
  const [activo, setActivo] = useState(defaultFormState.activo);

  const isEditing = useMemo(() => Boolean(editingId), [editingId]);

  const loadProviders = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("canastillas_proveedores")
      .select("id, nombre, contacto, telefono, notas, activo")
      .order("nombre", { ascending: true });

    if (error) {
      setErrorMessage(
        "No se pudieron cargar los proveedores. Verifica la conexión e intenta de nuevo.",
      );
      setIsLoading(false);
      return;
    }

    setProviders((data ?? []) as Provider[]);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadProviders();
  }, []);

  const resetForm = () => {
    setNombre(defaultFormState.nombre);
    setContacto(defaultFormState.contacto);
    setTelefono(defaultFormState.telefono);
    setNotas(defaultFormState.notas);
    setActivo(defaultFormState.activo);
    setEditingId(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nombre.trim()) return;
    setIsSaving(true);
    setErrorMessage(null);

    const payload = {
      nombre: nombre.trim(),
      contacto: contacto.trim() || null,
      telefono: telefono.trim() || null,
      notas: notas.trim() || null,
      activo,
    };

    const response = await fetch("/api/canastillas/proveedores", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, id: editingId }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setErrorMessage(
        result.error ??
          "No se pudo guardar el proveedor. Verifica la conexión e intenta de nuevo.",
      );
      setIsSaving(false);
      return;
    }

    resetForm();
    await loadProviders();
    setIsSaving(false);
  };

  const handleEdit = (provider: Provider) => {
    setEditingId(provider.id);
    setNombre(provider.nombre ?? "");
    setContacto(provider.contacto ?? "");
    setTelefono(provider.telefono ?? "");
    setNotas(provider.notas ?? "");
    setActivo(provider.activo ?? true);
  };

  const handleDelete = async (provider: Provider) => {
    const shouldDelete = window.confirm(
      `¿Seguro que quieres eliminar a ${provider.nombre}?`,
    );
    if (!shouldDelete) return;

    setIsSaving(true);
    setErrorMessage(null);

    const response = await fetch("/api/canastillas/proveedores", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: provider.id }),
    });

    const result = (await response.json()) as {
      error?: string;
      fallback?: boolean;
    };

    if (!response.ok) {
      setErrorMessage(
        result.error ??
          "No se pudo eliminar el proveedor. Verifica la conexión e intenta de nuevo.",
      );
      setIsSaving(false);
      return;
    }

    if (result.fallback) {
      setErrorMessage(
        "El proveedor no se pudo eliminar porque está en uso. Se marcó como inactivo.",
      );
    }

    if (editingId === provider.id) {
      resetForm();
    }
    await loadProviders();
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-[0.2em]">
              Canastillas
            </p>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Truck size={24} className="text-blue-600" />
              Gestión de proveedores
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Crea, actualiza y elimina proveedores de canastillas desde un solo
              lugar.
            </p>
          </div>
          <a
            href="/canastillas"
            className="text-sm font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <ArrowLeft size={16} /> Volver a canastillas
          </a>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="bg-white rounded-2xl border border-slate-400 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {isEditing ? "Editar proveedor" : "Crear proveedor"}
                </h2>
                <p className="text-sm text-slate-500">
                  {isEditing
                    ? "Actualiza la información y guarda los cambios."
                    : "Registra un proveedor nuevo para el inventario."}
                </p>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-400 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  <X size={14} /> Cancelar
                </button>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nombre del proveedor
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  required
                  placeholder="Ej. Proveedores del Norte"
                  className="w-full p-3 rounded-xl bg-slate-200 border border-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nombre de contacto
                </label>
                <input
                  type="text"
                  value={contacto}
                  onChange={(event) => setContacto(event.target.value)}
                  placeholder="Persona responsable"
                  className="w-full p-3 rounded-xl bg-slate-200 border border-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  placeholder="Número de contacto"
                  className="w-full p-3 rounded-xl bg-slate-200 border border-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={notas}
                  onChange={(event) => setNotas(event.target.value)}
                  rows={4}
                  placeholder="Horarios, condiciones o comentarios relevantes."
                  className="w-full p-3 rounded-xl bg-slate-200 border border-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all resize-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(event) => setActivo(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                />
                Proveedor activo
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all disabled:opacity-70"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <Save size={18} />
                    {isSaving
                      ? "Guardando..."
                      : isEditing
                        ? "Guardar cambios"
                        : "Crear proveedor"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 rounded-xl border border-slate-400 text-slate-600 font-semibold hover:border-slate-400 hover:text-slate-800"
                >
                  Limpiar formulario
                </button>
              </div>
              {errorMessage && (
                <p className="text-sm font-semibold text-red-600">
                  {errorMessage}
                </p>
              )}
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-400 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">
                Proveedores registrados
              </h2>
              <span className="text-xs font-semibold text-slate-400">
                {providers.length} en total
              </span>
            </div>
            {isLoading ? (
              <p className="text-sm text-slate-500">Cargando proveedores...</p>
            ) : providers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-400 bg-slate-200 p-6 text-center text-sm text-slate-500">
                Aún no hay proveedores registrados.
              </div>
            ) : (
              <div className="space-y-3">
                {providers.map((provider) => (
                  <div
                    key={provider.id}
                    className="rounded-xl border border-slate-400 bg-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {provider.nombre}
                        </p>
                        <p className="text-xs text-slate-500">
                          {provider.contacto || "Sin contacto"}
                          {provider.telefono ? ` · ${provider.telefono}` : ""}
                        </p>
                        {provider.notas && (
                          <p className="text-xs text-slate-400 mt-1">
                            {provider.notas}
                          </p>
                        )}
                        <span
                          className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            provider.activo
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {provider.activo ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(provider)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-400 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(provider)}
                          className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
