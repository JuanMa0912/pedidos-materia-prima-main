"use client";

import { supabase } from "@/lib/supabase";

type Material = {
  id: string;
  zona_id: string;
  nombre: string;
  presentacion_kg_por_bulto: number;
  tasa_consumo_diaria_kg: number | null;
  activo: boolean;
};

const cache: Record<string, Material[]> = {};

export async function getMateriales(zonaId: string): Promise<Material[]> {
  if (cache[zonaId]) return cache[zonaId];
  const { data } = await supabase
    .from("materiales")
    .select("*")
    .eq("zona_id", zonaId)
    .eq("activo", true)
    .order("nombre")
    .returns<Material[]>();
  cache[zonaId] = data ?? [];
  return cache[zonaId];
}
