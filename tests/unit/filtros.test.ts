import { describe, expect, it } from "vitest";
import { leerFiltros, urlExportar, urlListado } from "@/lib/filtros";

describe("leerFiltros", () => {
  it("lee estado y página válidos", () => {
    expect(leerFiltros({ estado: "pagado", pagina: "3" })).toEqual({ estado: "pagado", pagina: 3 });
  });

  it("sin parámetros ⇒ todos, página 1", () => {
    expect(leerFiltros({})).toEqual({ estado: null, pagina: 1 });
  });

  it("CA-09 estado y página inválidos se ignoran", () => {
    expect(leerFiltros({ estado: "xyz", pagina: "-3" })).toEqual({ estado: null, pagina: 1 });
    expect(leerFiltros({ estado: "", pagina: "0" })).toEqual({ estado: null, pagina: 1 });
    expect(leerFiltros({ pagina: "2.5" }).pagina).toBe(1);
    expect(leerFiltros({ pagina: "abc" }).pagina).toBe(1);
    expect(leerFiltros({ pagina: "99999999999999999999" }).pagina).toBe(1);
  });

  it("acepta URLSearchParams y toma el primer valor si viene repetido", () => {
    expect(leerFiltros(new URLSearchParams("estado=enviado&pagina=2"))).toEqual({ estado: "enviado", pagina: 2 });
    expect(leerFiltros({ estado: ["cancelado", "pagado"] }).estado).toBe("cancelado");
  });
});

describe("urlListado / urlExportar", () => {
  it("omite los valores por defecto", () => {
    expect(urlListado({ estado: null, pagina: 1 })).toBe("/pedidos");
  });

  it("CA-10 la paginación conserva el estado", () => {
    expect(urlListado({ estado: "pagado", pagina: 2 })).toBe("/pedidos?estado=pagado&pagina=2");
    expect(urlListado({ estado: "pagado", pagina: 1 })).toBe("/pedidos?estado=pagado");
  });

  it("CA-10 la exportación lleva el estado pero nunca la página", () => {
    expect(urlExportar("entregado")).toBe("/pedidos/exportar?estado=entregado");
    expect(urlExportar(null)).toBe("/pedidos/exportar");
  });

  it("ida y vuelta: lo que se escribe en la URL se vuelve a leer igual", () => {
    const filtros = { estado: "pendiente" as const, pagina: 7 };
    const url = new URL(urlListado(filtros), "http://x");
    expect(leerFiltros(url.searchParams)).toEqual(filtros);
  });
});
