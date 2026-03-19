"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { COBERTURA_TONO } from "@/app/(dashboard)/_components/dashboard";
import { MaterialRow } from "@/app/(dashboard)/_components/_types";

type notificationBellProps = {
  unreadCount: number;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  criticos: MaterialRow[];
  alerta: MaterialRow[];
  seguros: MaterialRow[];
};

export function NotificationBell({
  unreadCount,
  isOpen,
  onOpenChange,
  criticos,
  alerta,
  seguros,
}: notificationBellProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && containerRef.current?.contains(target)) {
        return;
      }

      onOpenChange(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onOpenChange]);
  const niveles: Array<{
    key: keyof typeof COBERTURA_TONO;
    items: MaterialRow[];
  }> = [
    { key: "critico", items: criticos },
    { key: "alerta", items: alerta },
    { key: "seguro", items: seguros },
  ];

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="secondary"
        size="icon"
        className={cn(
          "rounded-full border border-white/40 bg-white/20 text-white transition",
          (unreadCount > 0 || criticos.length > 0) &&
            "border-[#FF6B5A]/70 bg-[#FF6B5A]/15 text-white animate-[pulse_2s_ease-in-out_infinite]"
        )}
        onClick={() => onOpenChange(!isOpen)}
        aria-label="Abrir panel de alertas"
      >
        <Bell className="h-5 w-5" />
      </Button>
      {unreadCount > 0 && (
        <span className="absolute -top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#FF6B5A] text-xs font-semibold text-white shadow-lg">
          {unreadCount}
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {unreadCount} alertas sin leer
      </span>
      {isOpen && (
        <aside className="absolute right-0 top-14 z-20 w-screen max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-[#1F4F9C]/20 bg-white text-slate-900 shadow-2xl sm:w-96">
          <header className="bg-gradient-to-r from-[#1F4F9C]/90 to-[#5169A5] p-4 text-white">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle className="h-5 w-5" /> Alertas de inventario
            </h2>
            <p className="text-xs text-white/80"></p>
          </header>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {niveles.map(({ key, items }) => {
              const tone = COBERTURA_TONO[key];
              return (
                <section key={String(key)} className="bg-white/80">
                  <div className="flex items-start gap-3 p-4">
                    <span
                      className={cn("mt-1 h-10 w-1 rounded-full", tone.accent)}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold"> {tone.label}</p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium shadow-sm",
                            tone.badge
                          )}
                        >
                          {tone.description}
                        </span>
                      </div>
                      {items.length ? (
                        <ul className="space-y-2">
                          {items.map((m) => {
                            const coberturaDias =
                              m.cobertura != null
                                ? Math.max(0, m.cobertura)
                                : 0;
                            const coberturaRedondeada =
                              Math.floor(coberturaDias);
                            const coberturaLabel =
                              coberturaDias > 0 && coberturaDias < 1
                                ? "<1 día de cobertura"
                                : `${fmtNum(
                                    coberturaRedondeada
                                  )} días de cobertura`;
                            const zonas = m.zonas?.length
                              ? m.zonas.join(", ")
                              : null;
                            return (
                              <li
                                key={m.id}
                                className="rounded-xl border border-slate-100 bg-white/90 px-3 py-2 shadow-sm transition hover:border-[#1F4F9C]/30 hover:shadow-md"
                              >
                                <p className="text-sm font-medium text-slate-900">
                                  {m.nombre}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {coberturaLabel}
                                </p>
                                {zonas && (
                                  <p className="text-xs text-slate-500">
                                    Área: {zonas}
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p
                          className="flex items-center gap-2 rounded-lg bg-slate-50 p-3
                        text-xs text-slate-500"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Sin elementos en esta categorias
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
          <footer className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/80 p-4">
            <Button
              variant="ghost"
              className="text-slate-700 hover:text-slate-900 hover:border-[1F4F9C]/30 hover:shadow-sm"
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
          </footer>
        </aside>
      )}
    </div>
  );
}
