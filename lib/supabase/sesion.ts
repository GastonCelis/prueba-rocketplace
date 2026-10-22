// Refresca el token de sesión en cada request (patrón recomendado por @supabase/ssr).
// Los Server Components no pueden escribir cookies; por eso el refresco se hace en proxy.ts.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configSupabase } from "./config";

export async function actualizarSesion(request: NextRequest) {
  const { url, anonKey } = configSupabase();
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesParaGuardar, headers) {
        cookiesParaGuardar.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        cookiesParaGuardar.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        Object.entries(headers).forEach(([clave, valor]) => respuesta.headers.set(clave, valor));
      },
    },
  });

  // Valida el JWT y, si venció, lo renueva (las cookies nuevas salen por setAll).
  await supabase.auth.getClaims();

  return respuesta;
}
