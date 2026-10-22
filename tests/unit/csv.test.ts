import { describe, expect, it } from "vitest";
import { encabezadoCsv, escaparCampo, filaCsv, formatearFecha, formatearImporte, nombreArchivo } from "@/lib/csv";
import type { Pedido } from "@/lib/dominio";

const pedido = (cambios: Partial<Pedido> = {}): Pedido => ({
  id: 1,
  number: 42,
  customer_name: "Juan Pérez",
  status: "pagado",
  total: 1234.5,
  created_at: "2026-03-15T15:30:00Z",
  ...cambios,
});

describe("CA-12 formato para Excel en español", () => {
  it("empieza con BOM UTF-8, usa ; y CRLF", () => {
    const enc = encabezadoCsv();
    expect(enc.charCodeAt(0)).toBe(0xfeff);
    expect(Array.from(new TextEncoder().encode(enc).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(enc).toBe("﻿Número;Fecha;Cliente;Estado;Total\r\n");
  });

  it("importe con coma decimal y sin separador de miles", () => {
    expect(formatearImporte(1234.5)).toBe("1234,50");
    expect(formatearImporte("249999.99")).toBe("249999,99");
    expect(formatearImporte(0)).toBe("0,00");
  });

  it("fecha dd/mm/aaaa hh:mm en hora de Argentina (UTC-3)", () => {
    expect(formatearFecha("2026-03-15T15:30:00Z")).toBe("15/03/2026 12:30");
    // Pasada la medianoche UTC sigue siendo el día anterior en Argentina.
    expect(formatearFecha("2026-01-01T02:59:00Z")).toBe("31/12/2025 23:59");
  });

  it("fila completa", () => {
    expect(filaCsv(pedido())).toBe("42;15/03/2026 12:30;Juan Pérez;Pagado;1234,50\r\n");
  });

  it("nombre de archivo con estado y fecha de Argentina", () => {
    const ahora = new Date("2026-10-23T01:00:00Z"); // 22/10 a las 22:00 en Argentina
    expect(nombreArchivo("pagado", ahora)).toBe("pedidos-pagado-2026-10-22.csv");
    expect(nombreArchivo(null, ahora)).toBe("pedidos-todos-2026-10-22.csv");
  });
});

describe("CA-13 escapado", () => {
  it("deja igual los textos simples, con coma o con acentos", () => {
    expect(escaparCampo("Ñandú, S.A.")).toBe("Ñandú, S.A.");
  });

  it("entrecomilla si hay ;, comillas o saltos de línea, duplicando comillas", () => {
    expect(escaparCampo("Pérez; Juan")).toBe('"Pérez; Juan"');
    expect(escaparCampo('María "Mery" Núñez')).toBe('"María ""Mery"" Núñez"');
    expect(escaparCampo("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
  });

  it("la fila mantiene 5 columnas aunque el cliente tenga ;", () => {
    const fila = filaCsv(pedido({ customer_name: "Pérez; Juan" }));
    expect(fila).toBe('42;15/03/2026 12:30;"Pérez; Juan";Pagado;1234,50\r\n');
  });
});
