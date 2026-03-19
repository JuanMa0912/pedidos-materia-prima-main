"use client";
import { useEffect, useState } from "react";
import type { ToastType } from "./toastprovider";

type ToastProps = {
  message: string;
  type?: ToastType;
  timeout?: number;
  onDone?: () => void;
};

export function Toast({
  message,
  type = "success",
  timeout = 2500,
  onDone,
}: ToastProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setShow(false);
      onDone?.();
    }, timeout);
    return () => clearTimeout(t);
  }, [timeout, onDone]);

  if (!show) return null;

  // 🔹 Mapeamos tipos a estilos visuales
  const baseStyle =
    "fixed bottom-4 right-4 z-50 rounded-lg border px-3 py-2 text-sm shadow";
  const styleMap: Record<ToastType, string> = {
    success: "bg-green-50 border-green-600 text-green-800",
    error: "bg-red-50 border-red-600 text-red-800",
    info: "bg-blue-50 border-blue-600 text-blue-800",
    warning: "bg-yellow-50 border-yellow-600 text-yellow-800",
    ok: "bg-green-50 border-green-600 text-green-800", // alias de success
    err: "bg-red-50 border-red-600 text-red-800", // alias de error
  };

  return <div className={`${baseStyle} ${styleMap[type]}`}>{message}</div>;
}
