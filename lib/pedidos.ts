// Consultas a `orders`.
// IMPORTANTE: no se filtra por tienda en ningún lado. Eso lo hace la política RLS de Postgres (RF-07)
// usando el JWT del usuario que viaja en el cliente de Supabase.
import type { SupabaseClient } from "@supabase/supabase-js";
import { TAMANO_PAGINA, type EstadoPedido, type Pedido } from "./dominio";
import type { Filtros } from "./filtros";

const COLUMNAS = "id, number, customer_name, status, total, created_at";
/** Igual a `max_rows` de supabase/config.toml: la API no devuelve más filas por respuesta. */
export const TAMANO_LOTE_EXPORTACION = 1000;
/** PostgREST responde este código cuando se pide un rango más allá de la última fila. */
const FUERA_DE_RANGO = "PGRST103";

function consultaBase(supabase: SupabaseClient, estado: EstadoPedido | null, conteo: boolean) {
  let query = supabase
    .from("orders")
    .select(COLUMNAS, conteo ? { count: "exact" } : undefined)
    // `id` desempata pedidos con la misma fecha: el orden es estable y ninguna fila cambia de página.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (estado) query = query.eq("status", estado);
  return query;
}

export type PaginaPedidos = { pedidos: Pedido[]; total: number; totalPaginas: number };

/** RF-02/03: una página de 50 y el total de filas que cumplen el filtro. */
export async function listarPedidos(supabase: SupabaseClient, { estado, pagina }: Filtros): Promise<PaginaPedidos> {
  const desde = (pagina - 1) * TAMANO_PAGINA;
  const { data, count, error } = await consultaBase(supabase, estado, true).range(desde, desde + TAMANO_PAGINA - 1);

  if (error?.code === FUERA_DE_RANGO) {
    // Página más allá de la última (p. ej. URL editada a mano): sin filas, pero con el total real.
    let conteo = supabase.from("orders").select("id", { count: "exact", head: true });
    if (estado) conteo = conteo.eq("status", estado);
    const { count: total, error: errorConteo } = await conteo;
    if (errorConteo) throw errorConteo;
    return { pedidos: [], total: total ?? 0, totalPaginas: Math.ceil((total ?? 0) / TAMANO_PAGINA) };
  }
  if (error) throw error;

  const total = count ?? 0;
  return { pedidos: (data ?? []) as Pedido[], total, totalPaginas: Math.ceil(total / TAMANO_PAGINA) };
}

/**
 * RF-05: recorre TODOS los pedidos del filtro en lotes, con el mismo orden que el listado.
 * Hace falta porque la API corta cada respuesta en `max_rows` filas.
 */
export async function* recorrerPedidos(
  supabase: SupabaseClient,
  estado: EstadoPedido | null,
  tamanoLote = TAMANO_LOTE_EXPORTACION,
): AsyncGenerator<Pedido[]> {
  for (let desde = 0; ; desde += tamanoLote) {
    const { data, error } = await consultaBase(supabase, estado, false).range(desde, desde + tamanoLote - 1);
    if (error?.code === FUERA_DE_RANGO) return;
    if (error) throw error;
    const lote = (data ?? []) as Pedido[];
    if (lote.length > 0) yield lote;
    if (lote.length < tamanoLote) return; // lote incompleto ⇒ no hay más
  }
}
