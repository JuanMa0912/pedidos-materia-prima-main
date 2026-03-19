import React, { useRef, useEffect, useState } from "react";
import { RotateCcw, Check, PenTool } from "lucide-react";

interface Props {
  onSave: (dataUrl: string) => Promise<void> | void;
  onBack: () => void;
  isSaving: boolean;
  errorMessage?: string | null;
}

export const SignaturePad: React.FC<Props> = ({
  onSave,
  onBack,
  isSaving,
  errorMessage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas resolution for crisp lines
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#0f172a"; // slate-900
  }, []);

  const getCoordinates = (
    e: React.MouseEvent | React.TouchEvent | TouchEvent,
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const endDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const handleFinish = async () => {
    if (isEmpty || isSaving) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    await onSave(dataUrl);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
          <PenTool size={20} className="text-blue-600" />
          Firma de Verificación
        </h2>
        <p className="text-sm text-slate-500 mb-6 italic">
          Use su dedo o puntero para firmar en el recuadro gris.
        </p>

        <div className="relative group">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={endDrawing}
            onMouseOut={endDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={endDrawing}
            className="w-full h-64 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 touch-none cursor-crosshair transition-colors group-hover:border-blue-300"
          />

          <button
            onClick={clear}
            className="absolute top-4 right-4 p-2 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-500 hover:text-red-500 active:scale-90 transition-all"
            title="Borrar firma"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        <button
          onClick={handleFinish}
          disabled={isEmpty || isSaving}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
            isEmpty || isSaving
              ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
              : "bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700"
          }`}
        >
          <Check size={20} />
          {isSaving ? "Guardando..." : "Finalizar y Guardar"}
        </button>
        {errorMessage ? (
          <p className="text-sm text-red-600 text-center font-semibold">
            {errorMessage}
          </p>
        ) : null}
        <button
          onClick={onBack}
          className="w-full py-3 text-slate-500 font-semibold hover:text-slate-700"
        >
          Regresar a revisión
        </button>
      </div>
    </div>
  );
};
