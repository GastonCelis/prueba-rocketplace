/**
 * Integración contra la API real de Supabase local, con usuarios reales del seed.
 * Usa las mismas funciones que la app (listarPedidos, fragmentosCsv).
 */
import { describe, expect, it } from "vitest";
import { TAMANO_PAGINA } from "@/lib/dominio";
import { fragmentosCsv } from "@/lib/exportacion";
import { listarPedidos } from "@/lib/pedidos";
import { TIENDAS } from "../../scripts/generar-seed";
import { clienteAnonimo, clienteComo, contarReal, filasCsv, hayEntorno } from "./helpers";

const [almacen, libreria] = TIENDAS;

async function csvCompleto(...args: Parameters<typeof fragmentosCsv>) {
  let texto = "";
  for await (const fragmento of fragmentosCsv(...args)) texto += fragmento;
  return texto;
}

describe.skipIf(!hayEntorno)("Supabase local (API real)", () => {
  it("CA-01 vía API: el usuario solo recibe pedidos de su tienda, aunque no filtre", async () => {
    const ana = await clienteComo(almacen.usuarios[0].email);
    const { count: ajenos } = await ana.from("orders").select("id", { count: "exact", head: true }).neq("store_id", almacen.id);
    const { total } = await listarPedidos(ana, { estado: null, pagina: 1 });
    expect(ajenos).toBe(0);
    expect(total).toBe(await contarReal(almacen.id));
  });

  it("CA-04 vía API: anónimo no obtiene pedidos", async () => {
    const { data, error } = await clienteAnonimo().from("orders").select("id").limit(1);
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });

  it("CA-07 páginas de 50 y última incompleta", async () => {
    const carla = await clienteComo(libreria.usuarios[0].email);
    const total = await contarReal(libreria.id);
    const ultimaPagina = Math.ceil(total / TAMANO_PAGINA);

    const primera = await listarPedidos(carla, { estado: null, pagina: 1 });
    const ultima = await listarPedidos(carla, { estado: null, pagina: ultimaPagina });
    const fuera = await listarPedidos(carla, { estado: null, pagina: ultimaPagina + 1 });

    expect(primera.pedidos).toHaveLength(TAMANO_PAGINA);
    expect(primera.totalPaginas).toBe(ultimaPagina);
    expect(ultima.pedidos).toHaveLength(total - (ultimaPagina - 1) * TAMANO_PAGINA);
    expect(fuera).toEqual({ pedidos: [], total, totalPaginas: ultimaPagina });

    // Orden: del más reciente al más antiguo.
    const fechas = primera.pedidos.map((p) => p.created_at);
    expect([...fechas].sort().reverse()).toEqual(fechas);
  });

  it("CA-07 recorrer todas las páginas no repite ni pierde pedidos", async () => {
    const carla = await clienteComo(libreria.usuarios[0].email);
    const vistos = new Set<number>();
    const { totalPaginas, total } = await listarPedidos(carla, { estado: null, pagina: 1 });
    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
      for (const p of (await listarPedidos(carla, { estado: null, pagina })).pedidos) vistos.add(p.id);
    }
    expect(vistos.size).toBe(total);
  });

  it("CA-08 el filtro por estado devuelve solo ese estado y el total correcto", async () => {
    const ana = await clienteComo(almacen.usuarios[0].email);
    const { pedidos, total } = await listarPedidos(ana, { estado: "pagado", pagina: 1 });
    expect(pedidos.length).toBeGreaterThan(0);
    expect(pedidos.every((p) => p.status === "pagado")).toBe(true);
    expect(total).toBe(await contarReal(almacen.id, "pagado"));
  });

  it("CA-11 el CSV trae TODAS las filas filtradas, aunque superen max_rows (1000)", async () => {
    const ana = await clienteComo(almacen.usuarios[0].email);
    const esperado = await contarReal(almacen.id);
    expect(esperado).toBeGreaterThan(1000);

    const csv = await csvCompleto(ana, null);
    const filas = filasCsv(csv);
    const numeros = new Set(filas.map((f) => f.split(";")[0]));

    expect(csv.startsWith("﻿Número;Fecha;Cliente;Estado;Total\r\n")).toBe(true);
    expect(filas).toHaveLength(esperado);
    expect(numeros.size).toBe(esperado); // sin duplicados
  });

  it("CA-11 el CSV respeta el filtro por estado", async () => {
    const ana = await clienteComo(almacen.usuarios[0].email);
    const filas = filasCsv(await csvCompleto(ana, "entregado"));
    expect(filas).toHaveLength(await contarReal(almacen.id, "entregado"));
    expect(filas.every((f) => f.includes(";Entregado;"))).toBe(true);
  });

  it("CA-13 los clientes con comillas se exportan escapados", async () => {
    const ana = await clienteComo(almacen.usuarios[0].email);
    const csv = await csvCompleto(ana, null);
    expect(csv).toContain('"María ""Mery"" Núñez"');
  });
});
