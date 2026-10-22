// RF-05: el CSV completo como secuencia de fragmentos de texto (encabezado + un fragmento por lote).
// Separado del route handler para poder testearlo contra Supabase sin levantar Next.js.
import type { SupabaseClient } from "@supabase/supabase-js";
import { encabezadoCsv, filaCsv } from "./csv";
import type { EstadoPedido } from "./dominio";
import { recorrerPedidos } from "./pedidos";

export async function* fragmentosCsv(supabase: SupabaseClient, estado: EstadoPedido | null): AsyncGenerator<string> {
  yield encabezadoCsv();
  for await (const lote of recorrerPedidos(supabase, estado)) {
    yield lote.map(filaCsv).join("");
  }
}
