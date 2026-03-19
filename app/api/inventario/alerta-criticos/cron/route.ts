import { NextResponse } from "next/server";
import { calcularConsumoDiarioKg } from "@/lib/consumo";
import { calcularFechaCobertura } from "@/lib/utils";
import { getSupabaseAdmin } from "@/lib/supabasedamin";
import type { InventarioActualRow } from "@/app/(dashboard)/_components/_types";

const ALERTA_UMBRAL_DIAS = 3;
const ESTADOS_PENDIENTES = ["enviado"] as const;
const DESTINATARIOS = [
  "asiscalidadppt@mercamio.com",
  "jefedecalidad@mercamio.com",
];

type AlertaCritica = {
  zonaId: string;
  zonaNombre: string;
  materialId: string;
  materialNombre: string;
  cobertura: number;
  stock: number;
  unidad: string;
  hasta: string | null;
};

type ZonaRow = {
  id: string;
  nombre: string | null;
};

const toNumberOrZero = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : 0;
};

const obtenerFechaBogota = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

function calcularCobertura(item: InventarioActualRow) {
  const unidad = item.unidad_medida;
  const presentacion = item.presentacion_kg_por_bulto ?? 0;
  const stockBase = toNumberOrZero(item.stock);
  const stockKg = toNumberOrZero(item.stock_kg);
  const stockBultos = toNumberOrZero(item.stock_bultos);

  const stockBultosDisponibles =
    unidad === "unidad"
      ? stockBultos
      : stockBultos || (presentacion > 0 ? stockKg / presentacion : 0);

  const stockKgDisponibles = unidad === "unidad" ? 0 : stockKg || stockBase;

  const consumoUnidades =
    unidad === "unidad" &&
    typeof item.tasa_consumo_diaria_kg === "number" &&
    Number.isFinite(item.tasa_consumo_diaria_kg) &&
    item.tasa_consumo_diaria_kg > 0
      ? item.tasa_consumo_diaria_kg
      : null;

  const consumoKg =
    unidad === "unidad"
      ? null
      : calcularConsumoDiarioKg({
          nombre: item.nombre,
          unidad_medida: unidad,
          presentacion_kg_por_bulto: item.presentacion_kg_por_bulto,
          tasa_consumo_diaria_kg: item.tasa_consumo_diaria_kg,
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

  let hasta: string | null = null;
  if (coberturaDias != null && Number.isFinite(coberturaDias)) {
    const coberturaDate = calcularFechaCobertura({
      coberturaDias,
      fechaInicio: new Date(),
    });
    hasta = coberturaDate.toISOString().slice(0, 10);
  }

  const stock = unidad === "unidad" ? stockBultosDisponibles : stockKgDisponibles;

  return { coberturaDias, hasta, stock };
}

async function enviarEmail({
  subject,
  text,
  html,
}: {
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERTA_CRITICA_FROM;

  if (!apiKey || !from) {
    throw new Error(
      "Faltan RESEND_API_KEY o ALERTA_CRITICA_FROM para enviar el correo."
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: DESTINATARIOS,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error enviando email: ${response.status} ${errorText}`);
  }
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const fechaHoy = obtenerFechaBogota();

    const { data: envioPrevio, error: envioPrevioError } = await supabaseAdmin
      .from("alertas_criticos_envios")
      .select("id")
      .eq("fecha", fechaHoy)
      .maybeSingle();

    if (envioPrevioError) {
      if (envioPrevioError.code === "PGRST205") {
        console.warn(
          "alerta criticos: tabla alertas_criticos_envios no existe, se omite validacion",
        );
      } else {
        console.error("alerta criticos: error consultando envio previo", {
          envioPrevioError,
        });
        return NextResponse.json(
          { error: "No se pudo validar el envio previo" },
          { status: 500 },
        );
      }
    }

    if (envioPrevio) {
      return NextResponse.json({
        ok: true,
        skipped: "ya_enviado",
        fecha: fechaHoy,
      });
    }

    const { data: zonas, error: zonasError } = await supabaseAdmin
      .from("zonas")
      .select("id, nombre")
      .eq("activo", true);

    if (zonasError) {
      console.error("alerta criticos: error obteniendo zonas", zonasError);
      return NextResponse.json(
        { error: "No se pudieron obtener las zonas" },
        { status: 500 },
      );
    }

    const zonasActivas = (zonas ?? []) as ZonaRow[];
    if (!zonasActivas.length) {
      return NextResponse.json(
        { ok: true, skipped: "sin_zonas" },
        { status: 200 },
      );
    }

    const criticos: AlertaCritica[] = [];

    for (const zona of zonasActivas) {
      const { data, error } = await supabaseAdmin.rpc("inventario_actual", {
        p_zona: zona.id,
      });

      if (error) {
        console.error("alerta criticos: error inventario_actual", {
          zonaId: zona.id,
          error,
        });
        return NextResponse.json(
          { error: "No se pudo obtener el inventario actual" },
          { status: 500 },
        );
      }

      const filas = (data as InventarioActualRow[]) ?? [];
      for (const item of filas) {
        const { coberturaDias, hasta, stock } = calcularCobertura(item);
        if (
          coberturaDias != null &&
          Number.isFinite(coberturaDias) &&
          coberturaDias <= ALERTA_UMBRAL_DIAS
        ) {
          criticos.push({
            zonaId: item.zona_id,
            zonaNombre: zona.nombre ?? item.zona_id,
            materialId: item.material_id,
            materialNombre: item.nombre,
            cobertura: coberturaDias,
            stock,
            unidad: item.unidad_medida,
            hasta,
          });
        }
      }
    }

    if (!criticos.length) {
      return NextResponse.json({
        ok: true,
        skipped: "sin_criticos",
        fecha: fechaHoy,
      });
    }

    const materialIds = Array.from(
      new Set(criticos.map((item) => item.materialId)),
    );
    const zonaIds = Array.from(new Set(criticos.map((item) => item.zonaId)));

    const { data: pendientesRaw, error: pendientesError } = await supabaseAdmin
      .from("pedido_items")
      .select("material_id, pedidos!inner(estado, zona_id)")
      .in("material_id", materialIds)
      .in("pedidos.estado", ESTADOS_PENDIENTES)
      .in("pedidos.zona_id", zonaIds);

    if (pendientesError) {
      console.error("alerta criticos: error pedidos pendientes", pendientesError);
      return NextResponse.json(
        { error: "No se pudieron validar pedidos pendientes" },
        { status: 500 },
      );
    }

    const pendientes = new Set<string>();
    (pendientesRaw ?? []).forEach((item) => {
      const pedidoRaw = (item as { pedidos?: unknown }).pedidos;
      const pedido = Array.isArray(pedidoRaw)
        ? (pedidoRaw[0] as { zona_id?: string } | undefined)
        : (pedidoRaw as { zona_id?: string } | null | undefined);
      if (!pedido?.zona_id || !item.material_id) return;
      pendientes.add(`${pedido.zona_id}|${item.material_id}`);
    });

    const sinPedido = criticos.filter(
      (item) => !pendientes.has(`${item.zonaId}|${item.materialId}`),
    );

    if (!sinPedido.length) {
      return NextResponse.json({
        ok: true,
        skipped: "todos_con_pedido",
        fecha: fechaHoy,
      });
    }

    const subject = `Alerta critica de inventario (${fechaHoy})`;
    const lineasTexto = sinPedido.map(
      (item) =>
        `- ${item.zonaNombre} / ${item.materialNombre} / ${item.cobertura} dias / ${item.stock} ${item.unidad}`,
    );
    const text = [
      "Materiales criticos sin pedido pendiente:",
      ...lineasTexto,
    ].join("\n");

    const htmlItems = sinPedido
      .map(
        (item) =>
          `<li><strong>${item.zonaNombre}</strong> - ${item.materialNombre} - ${item.cobertura} dias - ${item.stock} ${item.unidad}</li>`,
      )
      .join("");
    const html = `<p>Materiales criticos sin pedido pendiente:</p><ul>${htmlItems}</ul>`;

    await enviarEmail({ subject, text, html });

    const { error: insertError } = await supabaseAdmin
      .from("alertas_criticos_envios")
      .insert({
        fecha: fechaHoy,
        total: sinPedido.length,
        destinatarios: DESTINATARIOS,
        detalle: sinPedido,
      });

    if (insertError) {
      if (insertError.code === "PGRST205") {
        console.warn(
          "alerta criticos: tabla alertas_criticos_envios no existe, se omite registro",
        );
      } else {
        console.error("alerta criticos: error guardando envio", insertError);
        return NextResponse.json(
          { error: "No se pudo registrar el envio" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      fecha: fechaHoy,
      total: sinPedido.length,
    });
  } catch (err) {
    console.error("alerta criticos: unexpected", err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "No se pudo enviar la alerta" },
      { status: 500 },
    );
  }
}
