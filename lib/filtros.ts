// RF-04: el filtro y la página viajan en la URL. Funciones puras ⇒ se testean sin base.
import { ESTADOS, type EstadoPedido } from "./dominio";

export type Filtros = { estado: EstadoPedido | null; pagina: number };

type Parametros = URLSearchParams | Record<string, string | string[] | undefined>;

function primerValor(params: Parametros, clave: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(clave) ?? undefined;
  const valor = params[clave];
  return Array.isArray(valor) ? valor[0] : valor;
}

export function leerEstado(params: Parametros): EstadoPedido | null {
  const valor = primerValor(params, "estado");
  return (ESTADOS as readonly string[]).includes(valor ?? "") ? (valor as EstadoPedido) : null;
}

/** Valores inválidos se ignoran: estado ⇒ todos, página ⇒ 1 (CA-09). */
export function leerFiltros(params: Parametros): Filtros {
  const texto = primerValor(params, "pagina") ?? "";
  const numero = Number(texto);
  const pagina = /^\d+$/.test(texto) && Number.isSafeInteger(numero) && numero >= 1 ? numero : 1;
  return { estado: leerEstado(params), pagina };
}

/** URL del listado. Omite los valores por defecto para que la URL quede limpia. */
export function urlListado({ estado, pagina }: Filtros): string {
  const params = new URLSearchParams();
  if (estado) params.set("estado", estado);
  if (pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return query ? `/pedidos?${query}` : "/pedidos";
}

/** URL de la descarga: lleva el estado pero no la página (RF-05). */
export function urlExportar(estado: EstadoPedido | null): string {
  return estado ? `/pedidos/exportar?estado=${estado}` : "/pedidos/exportar";
}
