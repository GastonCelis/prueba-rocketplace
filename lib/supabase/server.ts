// Cliente para Server Components, Server Actions y Route Handlers.
// Lee la sesión de las cookies ⇒ cada consulta viaja con el JWT del usuario y Postgres aplica RLS.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configSupabase } from "./config";

export async function crearClienteServidor() {
  const { url, anonKey } = configSupabase();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesParaGuardar) {
        try {
          cookiesParaGuardar.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // En un Server Component no se pueden escribir cookies; el refresco lo hace proxy.ts.
        }
      },
    },
  });
}
