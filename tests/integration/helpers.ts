// Utilidades para tests contra la API real de Supabase local (requiere `npm run db:start` y `npm run env:local`).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PASSWORD_DEMO } from "../../scripts/generar-seed";

export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const hayEntorno = Boolean(URL_SUPABASE && ANON_KEY && SERVICE_ROLE_KEY);

const sinSesionPersistente = { auth: { persistSession: false, autoRefreshToken: false } };

/** Cliente como lo usa la app: clave pública + sesión del usuario ⇒ RLS aplica. */
export async function clienteComo(email: string): Promise<SupabaseClient> {
  const cliente = createClient(URL_SUPABASE, ANON_KEY, sinSesionPersistente);
  const { error } = await cliente.auth.signInWithPassword({ email, password: PASSWORD_DEMO });
  if (error) throw new Error(`No se pudo iniciar sesión como ${email}: ${error.message}`);
  return cliente;
}

export const clienteAnonimo = () => createClient(URL_SUPABASE, ANON_KEY, sinSesionPersistente);

/** SOLO para calcular valores esperados en los tests: ignora RLS. Nunca se usa en la app. */
export const clienteAdmin = () => createClient(URL_SUPABASE, SERVICE_ROLE_KEY, sinSesionPersistente);

export async function contarReal(storeId: string, estado?: string): Promise<number> {
  let consulta = clienteAdmin().from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId);
  if (estado) consulta = consulta.eq("status", estado);
  const { count, error } = await consulta;
  if (error) throw error;
  return count ?? 0;
}

/** Separa un CSV en filas de datos (sin BOM ni encabezado). Los nombres del seed no tienen saltos de línea. */
export function filasCsv(csv: string): string[] {
  return csv.split("\r\n").slice(1, -1);
}
