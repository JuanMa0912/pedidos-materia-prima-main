"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Zona = { id: string; nombre: string; activo: boolean };

export default function ZoneSelector({
  value,
  onChange,
}: {
  value?: string;
  onChange: (zonaId: string) => void;
}) {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("zonas")
        .select("id,nombre,activo")
        .eq("activo", true)
        .order("nombre")
        .returns<Zona[]>();
      if (!error && data) {
        setZonas(data);
        if (!value && data.length > 0) onChange(data[0].id); // autoselección
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="text-sm text-gray-500">Cargando zonas…</div>;
  if (!zonas.length) return <div className="text-sm text-gray-500">No hay zonas activas.</div>;

  return (
    <select
      className="rounded-lg border px-3 py-2 text-sm"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      {zonas.map((z) => (
        <option key={z.id} value={z.id}>
          {z.nombre}
        </option>
      ))}
    </select>
  );
}
