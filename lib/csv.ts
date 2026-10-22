// RF-06 / spec §5: CSV que Excel en español abre sin ajustes. Funciones puras.
import { ETIQUETAS_ESTADO, ZONA_HORARIA, type EstadoPedido, type Pedido } from "./dominio";

/** Marca de orden de bytes: le avisa a Excel que el archivo es UTF-8 (si no, rompe acentos y ñ). */
export const BOM = "﻿";
/** En regional español la coma es decimal, así que Excel espera `;` entre columnas. */
export const SEPARADOR = ";";
export const FIN_DE_LINEA = "\r\n";
export const COLUMNAS = ["Número", "Fecha", "Cliente", "Estado", "Total"];

/** RFC 4180: si el campo tiene separador, comillas o salto de línea, va entre comillas y las comillas se duplican. */
export function escaparCampo(valor: string): string {
  return /[;"\r\n]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor;
}

/** 1234.5 → "1234,50" (sin separador de miles, para que Excel lo tome como número). */
export function formatearImporte(total: number | string): string {
  return Number(total).toFixed(2).replace(".", ",");
}

const partesFecha = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** ISO (UTC) → "dd/mm/aaaa hh:mm" en hora de Argentina. */
export function formatearFecha(iso: string): string {
  const p = Object.fromEntries(partesFecha.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

function linea(campos: string[]): string {
  return campos.map(escaparCampo).join(SEPARADOR) + FIN_DE_LINEA;
}

/** Primer fragmento del archivo: BOM + encabezado. */
export function encabezadoCsv(): string {
  return BOM + linea(COLUMNAS);
}

export function filaCsv(p: Pedido): string {
  return linea([String(p.number), formatearFecha(p.created_at), p.customer_name, ETIQUETAS_ESTADO[p.status], formatearImporte(p.total)]);
}

/** pedidos-<estado|todos>-<aaaa-mm-dd>.csv, con la fecha de Argentina. */
export function nombreArchivo(estado: EstadoPedido | null, ahora = new Date()): string {
  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(ahora);
  return `pedidos-${estado ?? "todos"}-${fecha}.csv`;
}
