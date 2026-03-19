"use client";
export const dynamic = "force-dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { PageContainer } from "@/components/PageContainer";

type Zona = { id: string; nombre: string };
const ZONAS_OBJETIVO = ["desposte", "desprese", "panificadora"] as const;

type ZonaObjetivo = (typeof ZONAS_OBJETIVO)[number];

const esZonaObjetivo = (nombre: string): nombre is ZonaObjetivo =>
  (ZONAS_OBJETIVO as readonly string[]).includes(nombre);

type Material = {
  id: string;
  zona_id: string;
  nombre: string;
  presentacion_kg_por_bulto: number | null;
  tasa_consumo_diaria_kg: number | null;
  proveedor: string | null;
  activo: boolean;
  unidad_medida: "bulto" | "unidad" | "litro";
};

export default function MaterialesPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaId, setZonaId] = useState<string>("");
  const [items, setItems] = useState<Material[]>([]);
  const [form, setForm] = useState({
    id: "",
    nombre: "",
    presentacion: "",
    consumo: "",
    proveedor: "",
    unidad_medida: "bulto" as "bulto" | "unidad" | "litro",
  });
  const [err, setErr] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(
    null,
  );

  // === FUNCIONES DE CARGA ===
  const cargarZonas = useCallback(async () => {
    const { data, error } = await supabase.from("zonas").select("*");
    if (error) {
      console.error(error);
      return;
    }
    const filtradas = (data ?? []).filter((z) =>
      esZonaObjetivo(z.nombre.trim().toLowerCase()),
    );
    setZonas(filtradas);
    if (filtradas.length > 0) setZonaId(filtradas[0].id);
  }, []);

  const cargarMateriales = useCallback(async () => {
    if (!zonaId) return;
    const { data, error } = await supabase
      .from("materiales")
      .select("*")
      .eq("zona_id", zonaId)
      .eq("activo", true)
      .returns<Material[]>();
    if (error) {
      console.error(error);
      return;
    }
    setItems(data ?? []);
    setUltimaActualizacion(new Date());
  }, [zonaId]);

  // === CRUD ===
  async function eliminarMaterial(id: string, nombre?: string) {
    const mensaje = nombre
      ? `¿Seguro desea eliminar el material "${nombre}"?`
      : "¿Seguro que desea eliminar este material?";
    if (!confirm(mensaje)) return;
    const { error } = await supabase
      .from("materiales")
      .update({ activo: false })
      .eq("id", id);

    if (error) {
      alert("❌ Error al eliminar: " + error.message);
    } else {
      alert("✅ Material eliminado");
      await cargarMateriales();
    }
  }

  function editarMaterial(material: Material) {
    setForm({
      id: material.id,
      nombre: material.nombre,
      presentacion: material.presentacion_kg_por_bulto?.toString() ?? "",
      consumo: material.tasa_consumo_diaria_kg?.toString() ?? "",
      proveedor: material.proveedor ?? "",
      unidad_medida: material.unidad_medida,
    });
    setZonaId(material.zona_id);
  }

  async function guardarMaterial() {
    if (!zonaId) return setErr("Selecciona una zona.");
    const nombre = form.nombre.trim();
    if (!nombre) return setErr("El nombre es obligatorio.");

    const presentacion =
      form.unidad_medida === "bulto" ? parseFloat(form.presentacion) || 0 : 1;

    const consumo =
      form.consumo.trim() === "" ? null : parseFloat(form.consumo);

    if (consumo !== null && (Number.isNaN(consumo) || consumo < 0)) {
      return setErr("Consumo diario inválido.");
    }

    const nuevo = {
      zona_id: zonaId,
      nombre,
      presentacion_kg_por_bulto: presentacion,
      tasa_consumo_diaria_kg: consumo,
      proveedor: form.proveedor.trim() || null,
      unidad_medida: form.unidad_medida,
      activo: true,
    };

    let error;
    if (form.id) {
      ({ error } = await supabase
        .from("materiales")
        .update(nuevo)
        .eq("id", form.id));
    } else {
      ({ error } = await supabase.from("materiales").insert(nuevo));
    }

    if (error) {
      console.error(
        "❌ Error al guardar material:",
        JSON.stringify(error, null, 2),
      );
      setErr("Error al guardar material.");
    } else {
      setForm({
        id: "",
        nombre: "",
        presentacion: "",
        consumo: "",
        proveedor: "",
        unidad_medida: "bulto",
      });
      setErr(null);
      await cargarMateriales();
    }
  }

  // === EFECTOS ===
  useEffect(() => {
    void cargarZonas();
  }, [cargarZonas]);

  useEffect(() => {
    if (zonaId) void cargarMateriales();
  }, [zonaId, cargarMateriales]);

  const zonaSeleccionada = zonas.find((z) => z.id === zonaId) ?? null;

  // === UI ===
  return (
    <PageContainer>
      {/* Encabezado */}
      <header className="flex flex-col gap-6 rounded-2xl border bg-gradient-to-r from-[#1F4F9C] via-[#1F4F9C]/90 to-[#29B8A6]/80 p-6 text-white shadow-lg lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-white/80">
            Materiales
          </p>
          <h1 className="text-3xl font-semibold">Centro de suministros</h1>
          <p className="text-sm text-white/80">
            {zonaSeleccionada
              ? `Trabajando en la zona ${zonaSeleccionada.nombre}`
              : "Selecciona una zona para comenzar"}
          </p>
          <p className="text-xs text-white/60">
            {ultimaActualizacion
              ? `Actualizado ${ultimaActualizacion.toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })} a las ${ultimaActualizacion.toLocaleTimeString("es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Sincronizando inventario..."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            variant="secondary"
            className="bg-white/15 text-white hover:bg-white/25"
          >
            <Link href="/">Volver al panel</Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="bg-white/15 text-white hover:bg-white/25"
          >
            <Link href="/inventario">Ver inventario</Link>
          </Button>
        </div>
      </header>

      {/* Contenido principal */}
      <Tabs value={zonaId} onValueChange={setZonaId} className="space-y-6">
        <TabsList className="flex w-full flex-initial justify-start gap-1.5 rounded-xl bg-muted/95 p-7 px-1 text">
          {zonas.map((zona) => (
            <TabsTrigger
              key={zona.id}
              value={zona.id}
              className="rounded-lg border border-b-transparent px-10 py-6 text-md font-sem data-[state=active]:border-b-[#3e74cc] data-[state=active]:bg-white data-[state=active]:text-[#1F4F9C]"
            >
              {zona.nombre}
            </TabsTrigger>
          ))}
        </TabsList>

        {zonas.map((zona) => (
          <TabsContent key={zona.id} value={zona.id} className="space-y-6">
            {/* RESUMEN */}
            <Card className="bg-slate-50">
              <CardHeader>
                <CardTitle>Resumen rápido</CardTitle>
                <CardDescription>
                  Sigue estos indicadores antes de crear o editar un material.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-dashed bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Zona activa
                  </p>
                  <p className="text- font-semibold text-slate-800">
                    {zona.nombre}
                  </p>
                </div>
                <div className="rounded-lg border border-dashed bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Materiales activos
                  </p>
                  <p className="text-lg font-semibold text-slate-800">
                    {zona.id === zonaId ? items.length : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-dashed bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Última Actualización
                  </p>
                  <p className="text-lg font-semibold text-slate-800">
                    {zona.id === zonaId && ultimaActualizacion
                      ? ultimaActualizacion.toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* FORMULARIO */}
            <Card>
              <CardHeader>
                <CardTitle> Registra el material</CardTitle>
                <CardDescription>
                  Completa los campos: nombre, unidad y cantidades. Guarda o
                  cancela los cambios antes de continuar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {err && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                    {err}
                  </p>
                )}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    <span>Nombre *</span>
                    <Input
                      value={form.nombre}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, nombre: e.target.value }))
                      }
                      placeholder="Ej: Salmuera X"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    <span>Unidad de medida *</span>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      value={form.unidad_medida}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          unidad_medida: e.target.value as
                            | "bulto"
                            | "unidad"
                            | "litro",
                        }))
                      }
                    >
                      <option value="bulto">Bultos (kg por bulto)</option>
                      <option value="unidad">Unidades</option>
                      <option value="litro">Litros</option>
                    </select>
                  </label>

                  {form.unidad_medida === "bulto" && (
                    <label className="space-y-2 text-sm font-medium text-slate-700">
                      <span>Presentación (kg/bulto) *</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.presentacion}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            presentacion: e.target.value,
                          }))
                        }
                        placeholder="20.00"
                      />
                    </label>
                  )}

                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    <span>
                      Consumo diario (
                      {form.unidad_medida === "bulto"
                        ? "bultos"
                        : form.unidad_medida === "unidad"
                          ? "unidades"
                          : "litros"}
                      )
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.consumo}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, consumo: e.target.value }))
                      }
                      placeholder="Ej: 5.25"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    <span>Proveedor (opcional)</span>
                    <Input
                      value={form.proveedor}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, proveedor: e.target.value }))
                      }
                      placeholder="ACME"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void guardarMaterial()}>
                    {form.id ? "Guardar cambios" : "Guardar material"}
                  </Button>
                  {form.id && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setForm({
                          id: "",
                          nombre: "",
                          presentacion: "",
                          consumo: "",
                          proveedor: "",
                          unidad_medida: "bulto",
                        });
                        setErr(null);
                      }}
                    >
                      Cancelar edición
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* TABLA */}
            <Card>
              <CardHeader className="  flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle> Revisa el listado</CardTitle>
                  <CardDescription>
                    Usa los botones para editar o dar de baja materiales sin
                    borrarlos del historial.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void cargarMateriales()}
                  disabled={!zonaId}
                >
                  Refrescar
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Presentación</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          {m.nombre}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                            {m.unidad_medida}
                          </span>
                        </TableCell>
                        <TableCell>
                          {m.unidad_medida === "bulto" &&
                          m.presentacion_kg_por_bulto
                            ? `${m.presentacion_kg_por_bulto} kg/bulto`
                            : m.unidad_medida === "unidad"
                              ? "Unidades"
                              : m.unidad_medida === "litro"
                                ? "Litros"
                                : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex h-full w-full items-center justify-center gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => editarMaterial(m)}
                              className="flex items-center gap-2 border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Editar
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void eliminarMaterial(m.id, m.nombre)
                              }
                              className="flex items-center gap-2 bg-rose-500 text-white shadow-sm transition hover:bg-rose-600"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Eliminar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!items.length && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-sm text-muted-foreground"
                        >
                          No hay materiales en esta zona. Usa el formulario de
                          arriba para crear el primero.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </PageContainer>
  );
}
