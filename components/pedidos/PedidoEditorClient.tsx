// components/pedidos/PedidoEditorClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import MaterialPicker from "@/components/MaterialPicker";
import { Button } from "@/components/ui/button";
import { round4, show2 } from "@/lib/math";
import { supabase } from "@/lib/supabase";

type Pedido = {
  id: string;
  zona_id: string;
  fecha_pedido: string; // YYYY-MM-DD
  solicitante: string | null;
  estado: "borrador" | "enviado" | "completado";
  inventario_posteado: boolean;
};

type ItemRow = {
  id?: string;
  material_id: string;
  presentacion?: number;
  bultos: number;
  kg: number;
  notas?: string;
};

export default function PedidoEditorClient({ pedidoId }: { pedidoId: string }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isEditable = pedido?.estado === "borrador";

  async function cargar() {
    setLoading(true);
    setErr(null);

    // Cabecera
    const { data: p, error } = await supabase
      .from("pedidos")
      .select("id,zona_id,fecha_pedido,solicitante,estado,inventario_posteado")
      .eq("id", pedidoId)
      .single()
      .returns<Pedido>();

    if (error || !p) {
      setErr("Pedido no encontrado");
      setLoading(false);
      return;
    }
    setPedido(p);

    // Ítems sin joins
    const { data: its, error: itErr } = await supabase
      .from("pedido_items")
      .select("id,material_id,bultos,kg,notas_item")
      .eq("pedido_id", pedidoId)
      .returns<
        {
          id: string;
          material_id: string;
          bultos: number;
          kg: number;
          notas_item: string | null;
        }[]
      >();

    if (itErr) {
      setErr(itErr.message);
      setLoading(false);
      return;
    }

    // Presentaciones
    const matIds = Array.from(new Set((its ?? []).map((r) => r.material_id)));
    const present: Record<string, number> = {};
    if (matIds.length) {
      const { data: mats } = await supabase
        .from("materiales")
        .select("id,presentacion_kg_por_bulto")
        .in("id", matIds)
        .returns<{ id: string; presentacion_kg_por_bulto: number }[]>();
      (mats ?? []).forEach(
        (m) => (present[m.id] = Number(m.presentacion_kg_por_bulto))
      );
    }

    const rows: ItemRow[] =
      (its ?? []).map((r) => ({
        id: r.id,
        material_id: r.material_id,
        presentacion: present[r.material_id] ?? undefined,
        bultos: Number(r.bultos),
        kg: Number(r.kg),
        notas: r.notas_item ?? undefined,
      })) ?? [];

    setItems(rows);
    setLoading(false);
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  const totB = useMemo(
    () => items.reduce((a, i) => a + (i.bultos || 0), 0),
    [items]
  );
  const totKg = useMemo(
    () => items.reduce((a, i) => a + (i.kg || 0), 0),
    [items]
  );

  async function guardarCabecera(upd: Partial<Pedido>) {
    if (!pedido) return;
    const { error } = await supabase
      .from("pedidos")
      .update(upd)
      .eq("id", pedido.id);
    if (error) setErr(error.message);
    else setPedido({ ...pedido, ...upd });
  }

  function addFila() {
    setItems((prev) => [{ material_id: "", bultos: 0, kg: 0 }, ...prev]);
  }

  async function onMaterialChange(
    idx: number,
    materialId: string,
    meta?: {
      nombre: string;
      presentacion_kg_por_bulto: number | null;
      unidad_medida: "bulto" | "unidad" | "litro";
    }
  ) {
    if (!pedido) return;
    let presentacion: number | undefined;
    if (meta) {
      presentacion =
        meta.presentacion_kg_por_bulto == null
          ? undefined
          : Number(meta.presentacion_kg_por_bulto);
    } else if (materialId) {
      const { data } = await supabase
        .from("materiales")
        .select("id,presentacion_kg_por_bulto")
        .eq("id", materialId)
        .single()
        .returns<{ id: string; presentacion_kg_por_bulto: number }>();
      if (!data) return;
      presentacion = Number(data.presentacion_kg_por_bulto);
    }
    setItems((prev) => {
      const copy = [...prev];
      const row = copy[idx];
      row.material_id = materialId;
      row.presentacion = presentacion;
      row.kg = round4((row.bultos || 0) * (row.presentacion || 0));
      return copy;
    });
  }

  function onBultosChange(idx: number, val: string) {
    setItems((prev) => {
      const copy = [...prev];
      const row = copy[idx];
      const b = Number((val ?? "").replace(",", "."));
      row.bultos = Number.isNaN(b) ? 0 : b;
      row.kg = round4((row.bultos || 0) * (row.presentacion || 0));
      return copy;
    });
  }

  function onNotasChange(idx: number, val: string) {
    setItems((prev) => {
      const c = [...prev];
      c[idx].notas = val;
      return c;
    });
  }

  async function guardarTodo() {
    if (!pedido) return;
    setErr(null);
    setMsg(null);

    for (const r of items) {
      if (!r.material_id) return setErr("Hay filas sin material.");
    }

    const { data: existentes } = await supabase
      .from("pedido_items")
      .select("id")
      .eq("pedido_id", pedido.id)
      .returns<{ id: string }[]>();
    const existentesIds = new Set((existentes ?? []).map((x) => x.id));
    const actualesIds = new Set(
      items.filter((i) => i.id).map((i) => i.id as string)
    );

    for (const r of items) {
      const payload = {
        pedido_id: pedido.id,
        material_id: r.material_id,
        bultos: round4(r.bultos || 0),
        kg: round4(r.kg || 0),
        notas_item: r.notas || null,
      };
      if (r.id) {
        await supabase.from("pedido_items").update(payload).eq("id", r.id);
      } else {
        const { data } = await supabase
          .from("pedido_items")
          .insert(payload)
          .select("id")
          .single();
        if (data) r.id = (data as { id: string }).id;
      }
    }

    for (const ex of existentesIds) {
      if (!actualesIds.has(ex)) {
        await supabase.from("pedido_items").delete().eq("id", ex);
      }
    }

    setMsg("Pedido guardado.");
    await cargar();
  }

  async function enviar() {
    if (!pedido) return;
    setErr(null);
    setMsg(null);

    if (!items.length) {
      setErr("No puedes enviar un pedido vacío.");
      return;
    }

    const { error } = await supabase
      .from("pedidos")
      .update({ estado: "enviado" })
      .eq("id", pedido.id);
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg("Pedido enviado.");
    await cargar();
  }

  async function completar() {
    if (!pedido) return;
    setErr(null);
    setMsg(null);

    if (pedido.inventario_posteado) {
      setErr("Este pedido ya impactó inventario.");
      return;
    }

    const { data: existsMov } = await supabase
      .from("movimientos_inventario")
      .select("id")
      .eq("ref_tipo", "pedido")
      .eq("ref_id", pedido.id)
      .limit(1);

    if ((existsMov ?? []).length > 0) {
      // Evitar duplicado
      const { error: upErr } = await supabase
        .from("pedidos")
        .update({ estado: "completado", inventario_posteado: true })
        .eq("id", pedido.id);
      if (upErr) setErr(upErr.message);
      else {
        setMsg("El pedido ya tenía movimientos; marcado como completado.");
        await cargar();
      }
      return;
    }

    const { data: its, error: itErr } = await supabase
      .from("pedido_items")
      .select("material_id,bultos,kg")
      .eq("pedido_id", pedido.id)
      .returns<{ material_id: string; bultos: number; kg: number }[]>();

    if (itErr) {
      setErr(itErr.message);
      return;
    }
    if (!its || !its.length) {
      setErr("No puedes completar un pedido sin ítems.");
      return;
    }

    const fecha = new Date().toISOString();

    for (const it of its) {
      const payload = {
        zona_id: pedido.zona_id,
        material_id: it.material_id,
        fecha,
        tipo: "entrada" as const,
        kg: Number(it.kg),
        bultos: Number(it.bultos),
        ref_tipo: "pedido",
        ref_id: pedido.id,
        notas: null as string | null,
      };
      const { error } = await supabase
        .from("movimientos_inventario")
        .insert(payload);
      if (error) {
        setErr("Error creando inventario: " + error.message);
        return;
      }
    }

    const { error: upErr } = await supabase
      .from("pedidos")
      .update({ estado: "completado", inventario_posteado: true })
      .eq("id", pedido.id);

    if (upErr) {
      setErr(upErr.message);
      return;
    }

    setMsg("Pedido completado e inventario actualizado.");
    await cargar();
  }

  function eliminarFila(idx: number) {
    const fila = items[idx];
    const mensaje = fila?.material_id
      ? "¿seguro deseas eliminar esta fila del material seleccionado?"
      : "¿Seguro deseas eliminar esta fila?";
    if (!confirm(mensaje)) return;
    setItems((prev) => {
      const c = [...prev];
      c.splice(idx, 1);
      return c;
    });
  }

  if (loading) return <main className="p-6">Cargando…</main>;
  if (!pedido) return <main className="p-6">No encontrado</main>;

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pedido</h1>
          <p className="text-sm text-gray-600">
            Estado: {pedido.estado}{" "}
            {pedido.inventario_posteado ? "· inventario posteado" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <>
              <Button onClick={guardarTodo} className="gap-2">
                <span role="img" aria-hidden="true"></span>
                Guardar
              </Button>
              <Button
                variant="outline"
                onClick={enviar}
                className="gap-2"
                title="Bloquea la edición de ítems"
              >
                <span role="img" aria-hidden="true">
                  📤
                </span>
                Enviar
              </Button>
            </>
          )}
          {pedido.estado === "enviado" && (
            <Button
              onClick={completar}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              title="Crea entradas de inventario y cierra el pedido"
            >
              <span role="img" aria-hidden="true">
                ✅
              </span>
              Completar
            </Button>
          )}
        </div>
      </header>

      {/* Cabecera */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Fecha</span>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-2"
              value={pedido.fecha_pedido}
              onChange={(e) =>
                setPedido({ ...pedido, fecha_pedido: e.target.value })
              }
              onBlur={(e) =>
                void guardarCabecera({ fecha_pedido: e.target.value })
              }
              disabled={!isEditable}
              onFocus={(e) => e.target.showPicker && e.target.showPicker()} // fuerza abrir el calendario
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-gray-700">Solicitante</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={pedido.solicitante ?? ""}
              onChange={(e) =>
                setPedido({ ...pedido, solicitante: e.target.value })
              }
              onBlur={(e) =>
                void guardarCabecera({ solicitante: e.target.value })
              }
              placeholder="Nombre"
              disabled={!isEditable}
            />
          </label>
        </div>
      </section>

      {/* Mensajes */}
      {err && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {msg}
        </div>
      )}

      {/* Ítems */}
      <section className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ítems</h2>
          {isEditable && (
            <Button variant="outline" onClick={addFila} className="gap-1">
              + Agregar ítem
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-2">Material</th>
                <th className="p-2">Presentación</th>
                <th className="p-2">Bultos</th>
                <th className="p-2">Kg</th>
                <th className="p-2">Notas</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r, idx) => (
                <tr key={r.id ?? `new-${idx}`} className="border-b">
                  <td className="p-2">
                    <MaterialPicker
                      zonaId={pedido.zona_id}
                      value={r.material_id}
                      onChange={(id, meta) =>
                        void onMaterialChange(idx, id, meta)
                      }
                    />
                  </td>
                  <td className="p-2">
                    {r.presentacion ? `${show2(r.presentacion)} kg/bulto` : "—"}
                  </td>
                  <td className="p-2">
                    <input
                      className="w-28 rounded-lg border px-2 py-1"
                      value={String(r.bultos ?? "")}
                      onChange={(e) => onBultosChange(idx, e.target.value)}
                      placeholder="0.00"
                      disabled={!isEditable}
                    />
                  </td>
                  <td className="p-2">{show2(r.kg || 0)}</td>
                  <td className="p-2">
                    <input
                      className="w-56 rounded-lg border px-2 py-1"
                      value={r.notas ?? ""}
                      onChange={(e) => onNotasChange(idx, e.target.value)}
                      placeholder="Opcional"
                      disabled={!isEditable}
                    />
                  </td>
                  <td className="p-2">
                    {isEditable && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => eliminarFila(idx)}
                        aria-label="Eliminar fila"
                      >
                        ✕
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={6}>
                    Aún no hay ítems.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-medium">
                <td className="p-2">Totales</td>
                <td className="p-2">—</td>
                <td className="p-2">{show2(totB)}</td>
                <td className="p-2">{show2(totKg)}</td>
                <td className="p-2" colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}
