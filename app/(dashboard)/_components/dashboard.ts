import {
  COBERTURA_ALERTA,
  COBERTURA_CRITICA,
  obtenerNivelCobertura,
} from "@/lib/cobertura";
import { PedidoEstado } from "@/app/(dashboard)/_components/_types";

export const ESTADO_LABEL: Record<PedidoEstado, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  recibido: "Recibido",
  completado: "Completado",
};

export const ESTADO_TONO: Record<PedidoEstado, string> = {
  borrador: "bg-slate-100 text-slate-700 border border-slate-200",
  enviado: "bg-[#1F4F9C]/10 text-[#1F4F9C] border border-[#1F4F9C]/20",
  recibido: "bg-[#29B8A6]/10 text-[#1F4F9C] border border-[#29B8A6]/20",
  completado: "bg-[#29B8A6] text-white border border-[#29B8A6]",
};

type CoberturaNivel = NonNullable<ReturnType<typeof obtenerNivelCobertura>>;

type CoberturaTone = {
  badge: string;
  accent: string;
  label: string;
  description: string;
};

export const COBERTURA_TONO: Record<CoberturaNivel, CoberturaTone> = {
  critico: {
    badge: "bg-[#FF6B5A]/15 text-[#FF6B5A] border border-[#FF6B5A]/30",
    accent: "bg-[#FF6B5A]",
    label: "Crítico",
    description: `Menos de ${COBERTURA_CRITICA} días de stock`,
  },
  alerta: {
    badge: "bg-[#F5A623]/15 text-[#B45309] border border-[#F5A623]/30",
    accent: "bg-[#F5A623]",
    label: "En alerta",
    description: `Entre ${COBERTURA_CRITICA} y ${COBERTURA_ALERTA} días`,
  },
  seguro: {
    badge: "bg-[#29B8A6]/15 text-[#0F766E] border border-[#29B8A6]/20",
    accent: "bg-[#29B8A6]",
    label: "Seguro",
    description: `Más de ${COBERTURA_ALERTA} días cubiertos`,
  },
};
