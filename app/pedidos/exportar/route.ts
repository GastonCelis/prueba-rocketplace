// RF-05, RF-06, CA-14: descarga CSV de todo el conjunto filtrado, en streaming.
import type { NextRequest } from "next/server";
import { nombreArchivo } from "@/lib/csv";
import { fragmentosCsv } from "@/lib/exportacion";
import { leerEstado } from "@/lib/filtros";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const estado = leerEstado(request.nextUrl.searchParams);
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  // Se escribe cada lote apenas llega: el archivo nunca está entero en memoria.
  const fragmentos = fragmentosCsv(supabase, estado);
  const codificador = new TextEncoder(); // UTF-8: el BOM del encabezado sale como EF BB BF
  const cuerpo = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await fragmentos.next();
        if (done) controller.close();
        else controller.enqueue(codificador.encode(value));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await fragmentos.return(undefined);
    },
  });

  return new Response(cuerpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo(estado)}"`,
      "Cache-Control": "no-store",
    },
  });
}
