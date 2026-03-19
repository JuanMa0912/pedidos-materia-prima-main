"use client";
export const dynamic = "force-dynamic";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type {
  InventarioActualRow,
  PedidoEstado,
} from "@/app/(dashboard)/_components/_types";
import { shouldRetryEstadoRecibido } from "@/lib/pedidos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/PageContainer";
import { InventarioHeader } from "./_components/InventarioHeader";
import { MaterialButton } from "./_components/MaterialButton";
import { MaterialAccionesDialog } from "./_components/MaterialAccionesDialog";
import { EditarInventarioDialog } from "./_components/EditarInventarioDialog";
import { ConsumoManualAgujasDialog } from "./_components/ConsumoManualAgujasDialog";
import { calcularConsumoDiarioKg } from "@/lib/consumo";
import { calcularFechaCobertura } from "@/lib/utils";
import {
  actualizarStockMap,
  buildNotaConStock,
  buildStockBultosMap,
  obtenerStockActual,
} from "@/lib/inventario-notas";
import type {
  MaterialConsumo,
  MaterialEditar,
  MovimientoInventario,
  StockRow,
  Unidad,
  Zona,
} from "./types";
import { parseFotoUrls, serializeFotoUrls } from "./_utils/fotos";

const EMPTY_EDITAR: MaterialEditar = {
  id: "",
  nombre: "",
  stockBultos: 0,
  unidad: "bulto",
};
const EMPTY_CONSUMO: MaterialConsumo = { id: "", nombre: "", unidad: "bulto" };
const REF_TIPO_CONSUMO_AGUJAS = "consumo_manual_agujas" as const;
const REF_TIPO_CONSUMO_SALMUERA = "consumo_manual_salmuera" as const;

const STORAGE_BUCKET_CONSUMOS = "consumos";
const MAX_FOTO_MB = 0.5;
const MAX_FOTO_DIMENSION = 1600;

type PedidoParaDeshacer = {
  id: string;
  fecha: string | null;
};

type AlertaCriticaItem = {
  zonaId: string;
  zonaNombre: string;
  materialId: string;
  materialNombre: string;
  cobertura: number | null;
  hasta: string | null;
  stock: number;
  unidad: Unidad;
  pedidoHecho: boolean;
};

const obtenerStockMap = async (zonaId: string) => {
  try {
    const response = await fetch(`/api/inventario?zonaId=${zonaId}`);

    if (!response.ok) {
      return new Map();
    }

    const payload = (await response.json()) as InventarioActualRow[];
    return buildStockBultosMap(payload);
  } catch (error) {
    console.warn("No se pudo obtener el stock actual", error);
    return new Map();
  }
};

function extractStoragePathFromPublicUrl(url: string | null) {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const marker = `/object/public/${STORAGE_BUCKET_CONSUMOS}/`;
    const pathIndex = parsedUrl.pathname.indexOf(marker);

    if (pathIndex === -1) return null;

    const path = parsedUrl.pathname.slice(pathIndex + marker.length);

    return path || null;
  } catch (error) {
    console.warn("No se pudo obtener la ruta de la foto", error);
    return null;
  }
}

async function compressImageFile(file: File, maxSizeMB: number) {
  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const maxDimension = Math.max(imageBitmap.width, imageBitmap.height);
  const scale =
    maxDimension > MAX_FOTO_DIMENSION ? MAX_FOTO_DIMENSION / maxDimension : 1;
  const targetWidth = Math.round(imageBitmap.width * scale);
  const targetHeight = Math.round(imageBitmap.height * scale);

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    imageBitmap.close();
    throw new Error("No se pudo crear el canvas para comprimir la imagen.");
  }

  context.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
  imageBitmap.close();

  const toBlob = (quality: number) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

  let quality = 0.92;
  let blob = await toBlob(quality);
  const maxBytes = maxSizeMB * 1024 * 1024;

  while (blob && blob.size > maxBytes && quality > 0.5) {
    quality -= 0.07;
    blob = await toBlob(quality);
  }

  if (!blob) {
    throw new Error("No se pudo comprimir la imagen.");
  }

  return new File([blob], file.name, {
    type: blob.type,
    lastModified: file.lastModified,
  });
}

function InventarioPageContent() {
  const searchParams = useSearchParams();

  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaId, setZonaId] = useState<string | null>(null);
  const zonaFromQuery = searchParams.get("zonaId");
  const [allZonaRows, setAllZonaRows] = useState<Map<string, StockRow[]>>(
    new Map(),
  );
  const [materialSeleccionado, setMaterialSeleccionado] = useState<{
    zonaId: string;
    zonaNombre: string;
    material: StockRow;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [showEditar, setShowEditar] = useState(false);
  const zonasInicializadas = useRef(false);
  const ultimaZonaQuery = useRef<string | null>(null);
  const [materialEditar, setMaterialEditar] =
    useState<MaterialEditar>(EMPTY_EDITAR);
  const [showConsumo, setShowConsumo] = useState(false);
  const [materialConsumo, setMaterialConsumo] =
    useState<MaterialConsumo>(EMPTY_CONSUMO);
  const [valorConsumo, setValorConsumo] = useState("");
  const [diaProceso, setDiaProceso] = useState("");
  const [notasConsumo, setNotasConsumo] = useState("");
  const [notasEditadas, setNotasEditadas] = useState(false);
  const [guardandoConsumo, setGuardandoConsumo] = useState(false);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [fotosConsumo, setFotosConsumo] = useState<File[]>([]);
  const [deshaciendoPedidoMaterialId, setDeshaciendoPedidoMaterialId] =
    useState<string | null>(null);
  const [showDeshacerPedidoModal, setShowDeshacerPedidoModal] = useState(false);
  const [pedidosHoy, setPedidosHoy] = useState<PedidoParaDeshacer[]>([]);
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<
    string | null
  >(null);
  const [cargandoPedidosHoy, setCargandoPedidosHoy] = useState(false);
  const [errorPedidosHoy, setErrorPedidosHoy] = useState<string | null>(null);
  const [materialDeshacerPedido, setMaterialDeshacerPedido] = useState<{
    id: string;
    nombre: string;
  } | null>(null);
  const deshaciendoPedidoRef = useRef(false);
  const [alertaCriticaItems, setAlertaCriticaItems] = useState<
    AlertaCriticaItem[]
  >([]);
  const [alertaCriticaDismissed, setAlertaCriticaDismissed] = useState(false);
  const [alertaCriticaLoading, setAlertaCriticaLoading] = useState(false);

  const buildNotasGenericas = (cantidad: number, unidad: Unidad) =>
    cantidad > 0
      ? `Consumo manual registrado (${cantidad} ${unidad}${
          cantidad !== 1 ? "s" : ""
        })`
      : "Consumo manual registrado";

  const manejarFotosConsumo = async (files: File[] | null) => {
    if (!files || files.length === 0) {
      setFotosConsumo([]);
      setFotoError(null);
      return;
    }
    if (files.length > 3) {
      setFotosConsumo([]);
      setFotoError("Solo puedes subir hasta 3 fotos por consumo.");
      return;
    }

    try {
      const compressedFiles: File[] = [];

      for (const file of files) {
        const compressedFile = await compressImageFile(file, MAX_FOTO_MB);
        if (compressedFile.size > MAX_FOTO_MB * 1024 * 1024) {
          setFotoError(
            "Alguna foto pesa más de 0.5 MB incluso después de comprimir.",
          );
          setFotosConsumo([]);
          return;
        }

        compressedFiles.push(compressedFile);
      }

      setFotosConsumo(compressedFiles);
      setFotoError(null);
    } catch (error) {
      console.error("Error comprimiendo foto de consumo:", error);
      setFotoError(
        "No se pudo procesar las imágenes. Intenta con otras fotos.",
      );
      setFotosConsumo([]);
    }
  };
  const abrirConsumoManual = async (
    id: string,
    nombre: string,
    unidad: Unidad,
  ) => {
    setMaterialConsumo({ id, nombre, unidad });
    setValorConsumo("");
    setDiaProceso("");
    setNotasConsumo(buildNotasGenericas(0, unidad));
    setNotasEditadas(false);
    setFotosConsumo([]);
    setFotoError(null);
    setShowConsumo(true);
  };

  const parseJsonResponse = async <T,>(
    response: Response,
  ): Promise<T | null> => {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return null;
    }
    try {
      return (await response.json()) as T;
    } catch (err) {
      console.warn("No se pudo leer JSON de la respuesta", err);
      return null;
    }
  };

  const guardarConsumoManual = async () => {
    if (guardandoConsumo) return;
    const cantidad = parseFloat(valorConsumo);
    if (Number.isNaN(cantidad) || cantidad <= 0) {
      alert("Por favor ingrese una cantidad válida.");
      return;
    }

    if (!diaProceso) {
      alert("Selecciona el día del proceso antes de guardar.");
      return;
    }

    if (!zonaId) {
      alert("Selecciona una zona antes de registrar consumo.");
      return;
    }
    if (fotoError) {
      alert(fotoError);
      return;
    }

    setGuardandoConsumo(true);

    const { id, unidad } = materialConsumo;
    const notasGenericas = buildNotasGenericas(cantidad, unidad);
    const notasBase = notasEditadas
      ? notasConsumo.trim()
      : notasConsumo.trim() || notasGenericas;
    let notas = notasBase;
    if (unidad === "bulto" && notasBase.length > 0) {
      const stockMap = await obtenerStockMap(zonaId);
      const stockActual = obtenerStockActual(stockMap, id);
      notas = buildNotaConStock({
        base: notasBase,
        tipo: "salida",
        cantidad,
        stockActual,
      });
    }
    let fotoUrl: string | null = null;

    const refTipo = (() => {
      const nombre = materialConsumo.nombre.toLowerCase();
      if (nombre.includes("salmuera")) return REF_TIPO_CONSUMO_SALMUERA;
      if (nombre.includes("aguja")) return REF_TIPO_CONSUMO_AGUJAS;
      return REF_TIPO_CONSUMO_AGUJAS;
    })();

    try {
      const { data: matData, error: matError } = await supabase
        .from("materiales")
        .select("presentacion_kg_por_bulto")
        .eq("id", id)
        .single();

      if (matError) {
        alert("❌ Error obteniendo presentación del material.");
        return;
      }

      const presentacion = matData?.presentacion_kg_por_bulto || 1;

      let bultos: number | null = null;
      let kg = 0;

      if (unidad === "bulto") {
        bultos = cantidad * -1;
        kg = cantidad * presentacion * -1;
      } else if (unidad === "litro") {
        bultos = null;
        kg = cantidad * -1;
      } else if (unidad === "unidad") {
        bultos = cantidad * -1;
        kg = 0;
      }
      if (fotosConsumo.length) {
        const urls: string[] = [];
        for (const foto of fotosConsumo) {
          const formData = new FormData();
          formData.set("file", foto);

          const response = await fetch("/api/consumos/upload", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const payload = await parseJsonResponse<{ error?: string }>(
              response,
            );
            const errorMessage = payload?.error || "Error subiendo la foto";
            alert("❌ " + errorMessage);
            return;
          }

          const payload = await parseJsonResponse<{ url: string }>(response);
          if (!payload?.url) {
            alert("❌ No se pudo leer la URL de la foto.");
            return;
          }
          const { url } = payload;
          urls.push(url);
        }

        fotoUrl = serializeFotoUrls(urls);
      }

      const { error } = await supabase.from("movimientos_inventario").insert({
        zona_id: zonaId,
        material_id: id,
        fecha: new Date().toISOString(),
        tipo: "salida",
        bultos,
        kg,
        ref_tipo: refTipo,
        dia_proceso: diaProceso,
        notas,
        foto_url: fotoUrl,
      });

      if (error) {
        alert("❌ Error registrando consumo manual: " + error.message);
      } else {
        alert("✅ Consumo manual guardado correctamente");

        setShowConsumo(false);
        setDiaProceso("");
        setNotasConsumo("");
        setNotasEditadas(false);
        setFotosConsumo([]);
        setFotoError(null);

        await cargarTodas();
      }
    } finally {
      setGuardandoConsumo(false);
    }
  };

  useEffect(() => {
    if (!showConsumo || notasEditadas) return;

    const cantidad = parseFloat(valorConsumo);
    if (Number.isNaN(cantidad) || cantidad <= 0) return;

    setNotasConsumo(buildNotasGenericas(cantidad, materialConsumo.unidad));
  }, [valorConsumo, materialConsumo.unidad, showConsumo, notasEditadas]);

  const deshacerConsumoManual = async (materialId: string) => {
    if (!zonaId) {
      alert("Selecciona una zona antes de deshacer un consumo.");
      return;
    }

    // 1️⃣ Identificar el ref_tipo según el tipo de material
    const allRows = Array.from(allZonaRows.values()).flat();
    const materialNombre = allRows
      .find((r: StockRow) => r.material_id === materialId)
      ?.nombre.toLowerCase();

    let refTiposValidos: string[] = [];

    if (materialNombre?.includes("salmuera")) {
      refTiposValidos = ["consumo_manual_salmuera"];
    } else if (materialNombre?.includes("aguja")) {
      refTiposValidos = ["consumo_manual_agujas"];
    } else {
      // fallback para otros materiales
      refTiposValidos = ["consumo_manual_agujas", "consumo_manual_salmuera"];
    }

    // 2️⃣ Buscar *el consumo más reciente* del material correcto
    const { data: mov, error: errMov } = await supabase
      .from("movimientos_inventario")
      .select(
        "id, bultos, kg, fecha, created_at, dia_proceso, material_id, foto_url",
      )
      .eq("zona_id", zonaId)
      .eq("material_id", materialId)
      .in("ref_tipo", refTiposValidos)
      .order("fecha", { ascending: false }) // incluye hora → orden correcto
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errMov || !mov) {
      alert("No hay consumo manual para deshacer en este material.");
      return;
    }

    // 3️⃣ Insertar entrada para revertir el consumo
    const stockMap = await obtenerStockMap(zonaId);
    const stockActual = obtenerStockActual(stockMap, materialId);
    const bultos = mov.bultos === null ? null : Math.abs(mov.bultos);
    const kg = mov.kg === null ? null : Math.abs(mov.kg);
    const notasBase = "deshacer consumo manual anterior";
    const notas = buildNotaConStock({
      base: notasBase,
      tipo: "entrada",
      cantidad: bultos,
      stockActual,
    });
    const { error: errUndo } = await supabase
      .from("movimientos_inventario")
      .insert({
        zona_id: zonaId,
        material_id: materialId,
        fecha: new Date().toISOString(),
        tipo: "entrada",
        bultos,
        kg,
        ref_tipo: "deshacer_consumo",
        dia_proceso: mov.dia_proceso,
        notas,
      });

    if (errUndo) {
      alert("Error al deshacer consumo: " + errUndo.message);
      return;
    }

    // 4️⃣ Marcar el movimiento original como anulado
    const { error: errMark } = await supabase
      .from("movimientos_inventario")
      .update({
        ref_tipo: "consumo_manual_anulado",
        ...(mov.foto_url ? { foto_url: null } : {}),
      })
      .eq("id", mov.id);

    if (errMark) {
      console.warn("Error marcando consumo manual como anulado:", errMark);
    }

    // 5️⃣ Borrar foto si existía
    const fotosPrevias = parseFotoUrls(mov.foto_url);
    for (const foto of fotosPrevias) {
      const photoPath = extractStoragePathFromPublicUrl(foto);
      if (photoPath) {
        await supabase.storage
          .from(STORAGE_BUCKET_CONSUMOS)
          .remove([photoPath]);
      }
    }

    alert("Consumo manual deshecho correctamente");
    await cargarTodas();
  };

  const abrirEditar = (
    id: string,
    nombre: string,
    stockBultos: number,
    unidad: Unidad,
  ) => {
    setMaterialEditar({ id, nombre, stockBultos, unidad });
    setShowEditar(true);
  };

  const guardarEdicion = async () => {
    if (!zonaId) {
      alert("Selecciona una zona antes de ajustar inventario.");
      return;
    }

    const { id, stockBultos } = materialEditar;
    const stockMap = await obtenerStockMap(zonaId);
    const stockActual = obtenerStockActual(stockMap, id);
    const cantidadAjuste =
      stockActual !== null ? Math.abs(stockBultos - stockActual) : null;
    const tipoAjuste =
      stockActual !== null && stockBultos >= stockActual ? "entrada" : "salida";
    const notasAjuste = buildNotaConStock({
      base: "Ajuste manual de inventario",
      tipo: tipoAjuste,
      cantidad: cantidadAjuste,
      stockActual,
    });

    try {
      const { error } = await supabase.rpc("ajustar_stock_absoluto", {
        p_zona: zonaId,
        p_material: id,
        p_nuevo_stock: stockBultos,
      });

      if (error) {
        alert("❌ Error guardando ajuste: " + error.message);
        return;
      }
      if (
        cantidadAjuste !== null &&
        Number.isFinite(cantidadAjuste) &&
        cantidadAjuste > 0
      ) {
        const { data: movimientoReciente, error: movimientoError } =
          await supabase
            .from("movimientos_inventario")
            .select("id")
            .eq("zona_id", zonaId)
            .eq("material_id", id)
            .order("fecha", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (movimientoError) {
          console.warn("No se pudo obtener el ajuste recién creado", {
            movimientoError,
          });
        } else if (movimientoReciente) {
          const { error: updateError } = await supabase
            .from("movimientos_inventario")
            .update({ notas: notasAjuste })
            .eq("id", movimientoReciente.id);

          if (updateError) {
            console.warn("No se pudo actualizar la nota del ajuste", {
              updateError,
            });
          }
        }
      }

      setShowEditar(false);
      await cargarTodas();
    } catch (err) {
      console.error(err);
      alert("❌ Error inesperado al guardar ajuste.");
    }
  };

  useEffect(() => {
    if (!materialSeleccionado) {
      setMovimientos([]);
      return;
    }
    const { zonaId: zId, material } = materialSeleccionado;

    (async () => {
      const { data: movs, error } = await supabase
        .from("movimientos_inventario")
        .select(
          "id, fecha, tipo, bultos, kg, notas, created_at, dia_proceso, foto_url, ref_tipo",
        )
        .eq("material_id", material.material_id)
        .eq("zona_id", zId)
        .order("fecha", { ascending: true })
        .order("created_at", { ascending: true });

      if (!error) {
        setMovimientos(movs ?? []);
      }
    })();
  }, [materialSeleccionado]);

  const actualizarNotasMovimiento = async (
    movimientoId: string,
    notas: string,
  ): Promise<boolean> => {
    const notasLimpias = notas.trim();
    if (!notasLimpias) {
      alert("Las notas no pueden quedar vacías.");
      return false;
    }

    const { error } = await supabase
      .from("movimientos_inventario")
      .update({ notas: notasLimpias })
      .eq("id", movimientoId);

    if (error) {
      alert("No se pudo actualizar la nota: " + error.message);
      return false;
    }

    setMovimientos((prev) =>
      prev.map((mov) =>
        mov.id === movimientoId ? { ...mov, notas: notasLimpias } : mov,
      ),
    );
    return true;
  };

  const procesarPayload = (payload: InventarioActualRow[]): StockRow[] => {
    const normalizarNumero = (valor: unknown) => {
      if (typeof valor === "number") return valor;
      if (typeof valor === "string") {
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : 0;
      }
      return 0;
    };

    const fechaReferencia = new Date();

    return payload.map((item) => {
      const unidad = item.unidad_medida as Unidad;
      const presentacion = item.presentacion_kg_por_bulto;
      const tasaConsumo = item.tasa_consumo_diaria_kg;

      const stockBase = normalizarNumero(item.stock);
      const stockKg = normalizarNumero(item.stock_kg);
      const stockBultos = normalizarNumero(item.stock_bultos);

      const presentacionSegura = presentacion ?? 0;

      const stockBultosDisponibles =
        unidad === "unidad"
          ? (stockBultos ?? stockBase)
          : (stockBultos ??
            (presentacionSegura > 0 ? stockKg! / presentacionSegura : 0));

      const stockKgDisponibles =
        unidad === "unidad" ? 0 : (stockKg ?? stockBase);

      const consumoUnidades =
        unidad === "unidad" &&
        typeof tasaConsumo === "number" &&
        Number.isFinite(tasaConsumo) &&
        tasaConsumo > 0
          ? tasaConsumo
          : null;

      const consumoKg =
        unidad === "unidad"
          ? null
          : calcularConsumoDiarioKg({
              nombre: item.nombre,
              unidad_medida: unidad,
              presentacion_kg_por_bulto: presentacion,
              tasa_consumo_diaria_kg: tasaConsumo,
            });

      let coberturaDias: number | null = null;

      if (consumoUnidades && consumoUnidades > 0) {
        const diasCalculados = stockBultosDisponibles / consumoUnidades;
        if (Number.isFinite(diasCalculados)) {
          coberturaDias = Math.max(0, Math.floor(diasCalculados));
        }
      } else if (consumoKg && consumoKg > 0) {
        const diasCalculados = stockKgDisponibles / consumoKg;
        if (Number.isFinite(diasCalculados)) {
          coberturaDias = Math.max(0, Math.floor(diasCalculados));
        }
      }

      const cobertura = coberturaDias;

      let hasta: string | null = null;

      if (
        coberturaDias != null &&
        Number.isFinite(coberturaDias) &&
        coberturaDias > 0
      ) {
        const coberturaDate = calcularFechaCobertura({
          coberturaDias,
          fechaInicio: fechaReferencia,
        });
        hasta = coberturaDate.toISOString().slice(0, 10);
      }

      return {
        material_id: item.material_id,
        nombre: item.nombre,
        stock:
          unidad === "unidad"
            ? stockBultosDisponibles
            : unidad === "bulto"
              ? stockBultosDisponibles
              : stockBase || stockKgDisponibles,
        stockKg: unidad === "unidad" ? 0 : stockKgDisponibles,
        unidad,
        hasta,
        cobertura,
      } satisfies StockRow;
    });
  };

  const cargarTodas = useCallback(async () => {
    if (!zonas.length) return;
    setLoading(true);

    try {
      const results = await Promise.all(
        zonas.map(async (zona) => {
          const response = await fetch(`/api/inventario?zonaId=${zona.id}`);
          if (!response.ok) return { zonaId: zona.id, rows: [] as StockRow[] };
          const payload =
            (await parseJsonResponse<InventarioActualRow[]>(response)) ?? [];
          return { zonaId: zona.id, rows: procesarPayload(payload) };
        }),
      );

      const newMap = new Map<string, StockRow[]>();
      for (const { zonaId: zId, rows } of results) {
        newMap.set(zId, rows);
      }
      setAllZonaRows(newMap);

      const zonasPorId = new Map(zonas.map((zona) => [zona.id, zona.nombre]));
      const criticos: AlertaCriticaItem[] = [];
      for (const { zonaId: zId, rows } of results) {
        for (const row of rows) {
          if (row.cobertura != null && row.cobertura <= 3) {
            criticos.push({
              zonaId: zId,
              zonaNombre: zonasPorId.get(zId) ?? "Zona",
              materialId: row.material_id,
              materialNombre: row.nombre,
              cobertura: row.cobertura,
              hasta: row.hasta,
              stock: row.stock,
              unidad: row.unidad,
              pedidoHecho: false,
            });
          }
        }
      }

      if (!criticos.length) {
        setAlertaCriticaItems([]);
        setAlertaCriticaDismissed(false);
        return;
      }

      setAlertaCriticaLoading(true);
      try {
        const materialIds = Array.from(
          new Set(criticos.map((item) => item.materialId)),
        );
        const zonaIds = Array.from(
          new Set(criticos.map((item) => item.zonaId)),
        );
        const buildKey = (zona: string, materialId: string | number) =>
          `${zona}|${String(materialId)}`;

        const response = await fetch("/api/inventario/alerta-criticos/pedidos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zonaIds, materialIds }),
        });

        if (!response.ok) {
          console.warn("No se pudo validar pedidos pendientes");
          setAlertaCriticaItems(criticos);
          return;
        }

        const payload = (await parseJsonResponse<{
          ok?: boolean;
          pedidos?: { zonaId: string; materialId: string }[];
        }>(response)) ?? { ok: false };

        if (!payload?.ok || !Array.isArray(payload.pedidos)) {
          setAlertaCriticaItems(criticos);
          return;
        }

        const pendientes = new Set(
          payload.pedidos.map((p) => buildKey(p.zonaId, p.materialId)),
        );

        const criticosConPedido = criticos.map((item) => ({
          ...item,
          pedidoHecho: pendientes.has(buildKey(item.zonaId, item.materialId)),
        }));
        setAlertaCriticaItems(criticosConPedido);
      } finally {
        setAlertaCriticaLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error obteniendo el inventario actual");
      setAllZonaRows(new Map());
    } finally {
      setLoading(false);
    }
  }, [zonas]);

  const formatearFechaMovimiento = (fecha: string | null) => {
    if (!fecha) return "sin hora";
    const fechaNormalizada = fecha.includes("T") ? fecha : `${fecha}T00:00:00`;
    const parsed = new Date(fechaNormalizada);
    if (Number.isNaN(parsed.getTime())) return "sin hora";
    return parsed.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const obtenerPedidosCompletadosHoy = useCallback(
    async (materialId: string) => {
      if (!zonaId) return [];
      const inicioHoy = new Date();
      inicioHoy.setHours(0, 0, 0, 0);
      const { data: movimientos, error } = await supabase
        .from("movimientos_inventario")
        .select("ref_id, created_at, fecha")
        .eq("zona_id", zonaId)
        .eq("ref_tipo", "pedido")
        .eq("material_id", materialId)
        .gte("created_at", inicioHoy.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      if (!movimientos?.length) {
        return [];
      }

      const idsOrdenados: string[] = [];
      const fechaPorId = new Map<string, string | null>();

      movimientos.forEach((mov) => {
        if (!mov.ref_id) return;
        if (idsOrdenados.includes(mov.ref_id)) return;
        idsOrdenados.push(mov.ref_id);
        fechaPorId.set(mov.ref_id, mov.created_at ?? mov.fecha ?? null);
      });

      if (!idsOrdenados.length) {
        return [];
      }

      const { data: pedidos, error: pedidosError } = await supabase
        .from("pedidos")
        .select("id, estado")
        .in("id", idsOrdenados);

      if (pedidosError) {
        throw pedidosError;
      }

      const estados = new Map(
        (pedidos ?? []).map((pedido) => [pedido.id, pedido.estado]),
      );

      return idsOrdenados
        .filter((id) => estados.get(id) === "completado")
        .map((id) => ({
          id,
          fecha: fechaPorId.get(id) ?? null,
        }));
    },
    [zonaId],
  );

  const abrirDeshacerPedidoModal = useCallback(
    (materialId: string, materialNombre: string) => {
      setMaterialDeshacerPedido({ id: materialId, nombre: materialNombre });
      setShowDeshacerPedidoModal(true);
    },
    [],
  );

  const cerrarDeshacerPedidoModal = useCallback(() => {
    setShowDeshacerPedidoModal(false);
    setMaterialDeshacerPedido(null);
    setPedidosHoy([]);
    setPedidoSeleccionadoId(null);
    setErrorPedidosHoy(null);
  }, []);

  useEffect(() => {
    if (!showDeshacerPedidoModal || !materialDeshacerPedido || !zonaId) return;
    let activo = true;

    const cargarPedidosHoy = async () => {
      setCargandoPedidosHoy(true);
      setErrorPedidosHoy(null);
      setPedidosHoy([]);
      setPedidoSeleccionadoId(null);

      try {
        const pedidos = await obtenerPedidosCompletadosHoy(
          materialDeshacerPedido.id,
        );
        if (!activo) return;
        setPedidosHoy(pedidos);
        if (pedidos.length === 1) {
          setPedidoSeleccionadoId(pedidos[0]?.id ?? null);
        }
      } catch (error) {
        if (!activo) return;
        console.error(error);
        setErrorPedidosHoy("No pudimos cargar los pedidos completados de hoy.");
      } finally {
        if (activo) {
          setCargandoPedidosHoy(false);
        }
      }
    };

    void cargarPedidosHoy();

    return () => {
      activo = false;
    };
  }, [
    obtenerPedidosCompletadosHoy,
    materialDeshacerPedido,
    showDeshacerPedidoModal,
    zonaId,
  ]);

  const deshacerPedidoSeleccionado = useCallback(
    async (pedidoId: string, materialNombre: string, materialId: string) => {
      if (deshaciendoPedidoRef.current) {
        return;
      }
      if (!zonaId) {
        alert("Selecciona una zona válida antes de deshacer un pedido.");
        return;
      }

      deshaciendoPedidoRef.current = true;
      setDeshaciendoPedidoMaterialId(materialId);

      try {
        const confirmar = window.confirm(
          `¿Deseas deshacer el pedido ${pedidoId} de ${materialNombre}?`,
        );

        if (!confirmar) {
          return;
        }
        const { data: pedidoActual, error: pedidoError } = await supabase
          .from("pedidos")
          .select("id, estado")
          .eq("id", pedidoId)
          .maybeSingle();

        if (!pedidoActual || pedidoActual.estado !== "completado") {
          alert(
            "El último pedido encontrado ya no está marcado como completado.",
          );
          return;
        }

        const { data: reversionPrevia, error: reversionError } = await supabase
          .from("movimientos_inventario")
          .select("id")
          .eq("zona_id", zonaId)
          .eq("ref_tipo", "pedido_deshacer")
          .eq("ref_id", pedidoId)
          .limit(1)
          .returns<{ id: string }[]>();

        if (reversionError) {
          console.error(reversionError);
          alert(
            "❌ Error verificando si el pedido ya había sido deshecho anteriormente.",
          );
          return;
        }

        if (reversionPrevia && reversionPrevia.length > 0) {
          alert(
            "Este pedido ya fue deshecho anteriormente. No es posible repetir la operación.",
          );
          return;
        }

        const { data: movimientosPedido, error: movimientosError } =
          await supabase
            .from("movimientos_inventario")
            .select("id, material_id, bultos, kg")
            .eq("zona_id", zonaId)
            .eq("ref_tipo", "pedido")
            .eq("ref_id", pedidoId)
            .returns<
              {
                id: string;
                material_id: string;
                bultos: number | null;
                kg: number | null;
              }[]
            >();

        if (movimientosError) {
          console.error(movimientosError);
          alert("❌ Error obteniendo los movimientos del pedido.");
          return;
        }

        if (!movimientosPedido?.length) {
          alert(
            "No se encontraron movimientos de inventario para el pedido seleccionado.",
          );
          return;
        }

        const fechaActual = new Date().toISOString();

        const stockMap = await obtenerStockMap(zonaId);

        const movimientosReverso = movimientosPedido.map((mov) => {
          const materialId = mov.material_id;
          const bultos = mov.bultos === null ? null : Number(mov.bultos);
          const stockActual = obtenerStockActual(stockMap, materialId);
          const notas = buildNotaConStock({
            base: "Salida automática por deshacer pedido completado",
            tipo: "salida",
            cantidad: bultos,
            stockActual,
          });
          actualizarStockMap(stockMap, materialId, "salida", bultos);

          return {
            zona_id: zonaId,
            material_id: materialId,
            fecha: fechaActual,
            tipo: "salida" as const,
            bultos,
            kg: mov.kg === null ? null : Number(mov.kg),
            ref_tipo: "pedido_deshacer",
            ref_id: pedidoId,
            notas,
          };
        });

        const { data: movimientosInsertados, error: insertError } =
          await supabase
            .from("movimientos_inventario")
            .insert(movimientosReverso)
            .select("id")
            .returns<{ id: string }[]>();

        if (insertError) {
          console.error(insertError);
          alert("❌ Error registrando la reversión del pedido.");
          return;
        }

        let pedidoActualizadoEstado: PedidoEstado | null = null;
        const actualizadoRecibido = await supabase
          .from("pedidos")
          .update({ estado: "recibido", inventario_posteado: false })
          .eq("id", pedidoId)
          .select("estado")
          .maybeSingle();

        let actualizarPedidoError = actualizadoRecibido.error ?? null;

        if (!actualizarPedidoError && actualizadoRecibido.data) {
          pedidoActualizadoEstado = actualizadoRecibido.data
            .estado as PedidoEstado;
        } else if (actualizarPedidoError) {
          if (shouldRetryEstadoRecibido(actualizarPedidoError)) {
            console.warn(
              "Fallo al devolver el pedido al estado 'recibido'. Se intentará marcar como 'enviado'.",
              actualizarPedidoError,
            );
            const actualizadoEnviado = await supabase
              .from("pedidos")
              .update({ estado: "enviado", inventario_posteado: false })
              .eq("id", pedidoId)
              .select("estado")
              .maybeSingle();

            actualizarPedidoError = actualizadoEnviado.error ?? null;
            if (!actualizarPedidoError && actualizadoEnviado.data) {
              pedidoActualizadoEstado = actualizadoEnviado.data
                .estado as PedidoEstado;
            }
          }
        }

        if (actualizarPedidoError) {
          console.error(actualizarPedidoError);
          if (movimientosInsertados?.length) {
            await supabase
              .from("movimientos_inventario")
              .delete()
              .in(
                "id",
                movimientosInsertados.map((mov) => mov.id),
              );
          }
          alert(
            "❌ No se pudo actualizar el pedido. Intenta nuevamente en unos minutos.",
          );
          return;
        }

        alert("✅ Pedido deshecho y restaurado en la lista de pedidos.");
        cerrarDeshacerPedidoModal();

        await cargarTodas();

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("pedidos:invalidate", {
              detail: { zonaId },
            }),
          );
        }
      } catch (error) {
        console.error(error);
        alert("❌ Ocurrió un error inesperado al deshacer el pedido.");
      } finally {
        deshaciendoPedidoRef.current = false;
        setDeshaciendoPedidoMaterialId(null);
      }
    },
    [cargarTodas, cerrarDeshacerPedidoModal, zonaId],
  );

  useEffect(() => {
    async function cargarZonas() {
      const { data } = await supabase
        .from("zonas")
        .select("id,nombre")
        .eq("activo", true)
        .order("nombre");

      if (data?.length) {
        const ordenPreferido = ["Desposte", "Desprese", "Panificadora"];
        const zonasOrdenadas = data
          .filter((zona) => zona.nombre !== "Inventario General")
          .sort((a, b) => {
            const indexA = ordenPreferido.indexOf(a.nombre);
            const indexB = ordenPreferido.indexOf(b.nombre);

            if (indexA === -1 && indexB === -1) {
              return a.nombre.localeCompare(b.nombre);
            }
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });

        setZonas(zonasOrdenadas);
      }
    }
    void cargarZonas();
  }, []);

  useEffect(() => {
    if (!zonas.length) {
      ultimaZonaQuery.current = null;
      zonasInicializadas.current = false;
      if (zonaId !== null) {
        setZonaId(null);
      }
      return;
    }

    const zonaQueryValida =
      zonas.find((zona) => zona.id === zonaFromQuery)?.id ?? null;
    if (
      zonasInicializadas.current &&
      zonaQueryValida === ultimaZonaQuery.current
    ) {
      return;
    }

    const zonaValida = zonaQueryValida ?? zonas[0]?.id ?? null;

    ultimaZonaQuery.current = zonaQueryValida;

    if (zonaValida !== zonaId) {
      setZonaId(zonaValida);
    }

    zonasInicializadas.current = true;
  }, [zonas, zonaFromQuery, zonaId]);

  useEffect(() => {
    if (zonas.length) void cargarTodas();
  }, [cargarTodas, zonas]);

  const allRows = Array.from(allZonaRows.values()).flat();
  const totalMateriales = allRows.length;
  const materialesCriticos = allRows.filter(
    (row: StockRow) => row.cobertura != null && row.cobertura <= 3,
  ).length;
  const materialesEstables = allRows.filter(
    (row: StockRow) => row.cobertura != null && row.cobertura >= 10,
  ).length;

  const mostrarAlertaCritica =
    alertaCriticaItems.length > 0 && !alertaCriticaDismissed;

  return (
    <PageContainer>
      {mostrarAlertaCritica && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border bg-white shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-600">
                  Alerta critica
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Materiales con cobertura critica
                </h2>
                <p className="text-sm text-slate-600">
                  Si ya registraste un pedido, veras la etiqueta "Pedido hecho"
                  en el material correspondiente.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => setAlertaCriticaDismissed(true)}
                >
                  Cerrar alerta
                </Button>
              </div>
            </div>
            <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                {alertaCriticaItems.map((item) => (
                  <div
                    key={`${item.zonaId}-${item.materialId}`}
                    className="rounded-xl border border-rose-100 bg-rose-50/40 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
                        {item.zonaNombre}
                      </p>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                          item.pedidoHecho
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {item.pedidoHecho ? "Pedido hecho" : "Sin pedido"}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                      {item.materialNombre}
                    </h3>
                    <div className="mt-3 space-y-1 text-sm text-slate-700">
                      <p>
                        Cobertura:{" "}
                        <span className="font-semibold text-rose-600">
                          {item.cobertura ?? 0} dias
                        </span>
                      </p>
                      <p>
                        Stock actual:{" "}
                        <span className="font-semibold">
                          {item.stock} {item.unidad}
                        </span>
                      </p>
                      <p>
                        Cobertura hasta:{" "}
                        <span className="font-semibold">
                          {item.hasta
                            ? new Date(item.hasta).toLocaleDateString("es-CO")
                            : "Sin fecha"}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {alertaCriticaLoading && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Validando pedidos pendientes...
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <InventarioHeader
        totalMateriales={totalMateriales}
        materialesCriticos={materialesCriticos}
        materialesEstables={materialesEstables}
        loading={loading}
        onRefresh={() => void cargarTodas()}
      />

      <section>
        {zonas.length ? (
          <div className="grid gap-6 md:grid-cols-3">
            {zonas.map((zona) => {
              const zonaRows = allZonaRows.get(zona.id) ?? [];
              return (
                <div
                  key={zona.id}
                  className="rounded-xl border bg-white p-4 shadow-sm"
                >
                  <h2 className="mb-3 text-lg font-semibold text-slate-800">
                    {zona.nombre}
                  </h2>
                  {loading ? (
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={`skel-${zona.id}-${i}`}
                          className="h-14 animate-pulse rounded-xl border bg-slate-100"
                        />
                      ))}
                    </div>
                  ) : zonaRows.length ? (
                    <div className="flex flex-col gap-2">
                      {zonaRows.map((row) => (
                        <MaterialButton
                          key={row.material_id}
                          row={row}
                          onClick={() => {
                            setZonaId(zona.id);
                            setMaterialSeleccionado({
                              zonaId: zona.id,
                              zonaNombre: zona.nombre,
                              material: row,
                            });
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No hay materiales registrados.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border py-12 text-center shadow-lg">
            <h3 className="text-xl font-semibold">No hay zonas activas</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Configura zonas activas en el panel de administración para
              visualizar el inventario.
            </p>
          </div>
        )}
      </section>

      <MaterialAccionesDialog
        open={materialSeleccionado !== null}
        material={materialSeleccionado?.material ?? null}
        zonaNombre={materialSeleccionado?.zonaNombre ?? ""}
        movimientos={movimientos}
        onUpdateNotas={actualizarNotasMovimiento}
        onClose={() => setMaterialSeleccionado(null)}
        onEditar={abrirEditar}
        onConsumo={abrirConsumoManual}
        onDeshacerConsumo={deshacerConsumoManual}
        onDeshacerPedido={abrirDeshacerPedidoModal}
        deshaciendoPedidoMaterialId={deshaciendoPedidoMaterialId}
      />
      <Dialog
        open={showDeshacerPedidoModal}
        onOpenChange={(value) => {
          if (!value) {
            cerrarDeshacerPedidoModal();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Deshacer pedido completado</DialogTitle>
            <DialogDescription>
              Selecciona el pedido completado hoy para{" "}
              {materialDeshacerPedido?.nombre ?? "este material"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {cargandoPedidosHoy ? (
              <p className="text-sm text-muted-foreground">
                Cargando pedidos completados de hoy...
              </p>
            ) : errorPedidosHoy ? (
              <p className="text-sm text-rose-600">{errorPedidosHoy}</p>
            ) : pedidosHoy.length ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pedidos completados hoy
                </p>
                <div className="max-h-60 space-y-2 overflow-y-auto pr-2">
                  {pedidosHoy.map((pedido) => {
                    const seleccionado = pedidoSeleccionadoId === pedido.id;
                    return (
                      <button
                        key={pedido.id}
                        type="button"
                        onClick={() => setPedidoSeleccionadoId(pedido.id)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                          seleccionado
                            ? "border-[#1F4F9C] bg-[#1F4F9C]/10 text-[#1F4F9C]"
                            : "border-muted bg-background hover:bg-muted/60"
                        }`}
                      >
                        <span className="font-medium">Pedido {pedido.id}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatearFechaMovimiento(pedido.fecha)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay pedidos completados hoy para este material.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={cerrarDeshacerPedidoModal}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                !pedidoSeleccionadoId ||
                cargandoPedidosHoy ||
                Boolean(errorPedidosHoy)
              }
              onClick={() => {
                if (!pedidoSeleccionadoId || !materialDeshacerPedido) return;
                void deshacerPedidoSeleccionado(
                  pedidoSeleccionadoId,
                  materialDeshacerPedido.nombre,
                  materialDeshacerPedido.id,
                );
              }}
            >
              {deshaciendoPedidoMaterialId === materialDeshacerPedido?.id
                ? "Deshaciendo..."
                : "Deshacer pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditarInventarioDialog
        open={showEditar}
        material={materialEditar}
        onClose={() => {
          setShowEditar(false);
          setMaterialEditar(EMPTY_EDITAR);
        }}
        onChange={(value) =>
          setMaterialEditar((prev) => ({
            ...prev,
            stockBultos: value,
          }))
        }
        onSubmit={() => void guardarEdicion()}
      />

      <ConsumoManualAgujasDialog
        open={showConsumo}
        material={materialConsumo}
        value={valorConsumo}
        selectedDay={diaProceso}
        onClose={() => {
          setShowConsumo(false);
          setMaterialConsumo(EMPTY_CONSUMO);
          setDiaProceso("");
          setNotasConsumo("");
          setNotasEditadas(false);
          setGuardandoConsumo(false);
          setFotosConsumo([]);
          setFotoError(null);
        }}
        onChange={setValorConsumo}
        onDayChange={setDiaProceso}
        onNotesChange={(value) => {
          setNotasConsumo(value);
          setNotasEditadas(true);
        }}
        notesValue={notasConsumo}
        notesLabel="Notas del consumo"
        notesPlaceholder="Puedes ajustar el mensaje genérico o agregar observaciones"
        onPhotosChange={manejarFotosConsumo}
        photoNames={fotosConsumo.map((file) => file.name)}
        photoError={fotoError}
        onSubmit={() => void guardarConsumoManual()}
        submitting={guardandoConsumo}
      />
    </PageContainer>
  );
}

export default function InventarioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-10 text-sm text-muted-foreground">
          Cargando inventario...
        </div>
      }
    >
      <InventarioPageContent />
    </Suspense>
  );
}
