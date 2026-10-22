/**
 * Test HTTP de punta a punta contra la app levantada (`npm run verificar` la levanta y define APP_URL).
 * Inicia sesión igual que el navegador: obtiene las cookies que genera @supabase/ssr y las manda en cada request.
 */
import { createServerClient } from "@supabase/ssr";
import { beforeAll, describe, expect, it } from "vitest";
import { PASSWORD_DEMO, TIENDAS } from "../../scripts/generar-seed";
import { ANON_KEY, URL_SUPABASE, contarReal, filasCsv, hayEntorno } from "./helpers";

const APP_URL = process.env.APP_URL;
const [almacen, libreria] = TIENDAS;

async function cookiesDeSesion(email: string): Promise<string> {
  const frasco = new Map<string, string>();
  const supabase = createServerClient(URL_SUPABASE, ANON_KEY, {
    cookies: {
      getAll: () => [...frasco].map(([name, value]) => ({ name, value })),
      setAll: (lista) => lista.forEach(({ name, value }) => frasco.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD_DEMO });
  if (error) throw error;
  return [...frasco].map(([nombre, valor]) => `${nombre}=${valor}`).join("; ");
}

describe.skipIf(!APP_URL || !hayEntorno)("App levantada (HTTP)", () => {
  let cookieCarla = "";
  beforeAll(async () => {
    cookieCarla = await cookiesDeSesion(libreria.usuarios[0].email);
  });

  it("CA-14 sin sesión, /pedidos/exportar responde 401", async () => {
    const res = await fetch(`${APP_URL}/pedidos/exportar`);
    expect(res.status).toBe(401);
  });

  it("RF-09 sin sesión, /pedidos redirige a /login", async () => {
    const res = await fetch(`${APP_URL}/pedidos`, { redirect: "manual" });
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toMatch(/\/login$/);
  });

  it("CA-08/CA-10 el filtro de la URL se aplica y la paginación lo conserva", async () => {
    const res = await fetch(`${APP_URL}/pedidos?estado=pagado&pagina=2`, { headers: { cookie: cookieCarla } });
    // React separa textos contiguos con <!-- -->; se quitan para comparar el texto visible.
    const html = (await res.text()).replaceAll("<!-- -->", "");
    const total = await contarReal(libreria.id, "pagado");
    expect(res.status).toBe(200);
    expect(html).toContain(libreria.nombre);
    expect(html).toContain(`de ${total}`);
    expect(html).toContain("Página 2 de");
    expect(html).toContain('href="/pedidos?estado=pagado"'); // "← Anterior" (página 1) conserva el estado
    expect(html).toContain("/pedidos/exportar?estado=pagado");
  });

  it("CA-11/CA-12 la descarga trae todo el filtro con el formato para Excel", async () => {
    const res = await fetch(`${APP_URL}/pedidos/exportar?estado=pagado`, { headers: { cookie: cookieCarla } });
    const bytes = new Uint8Array(await res.arrayBuffer());
    const texto = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="pedidos-pagado-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(filasCsv(texto)).toHaveLength(await contarReal(libreria.id, "pagado"));
  });

  it("CA-11 vía HTTP: más de 1000 filas en una sola descarga", async () => {
    const cookieAna = await cookiesDeSesion(almacen.usuarios[0].email);
    const res = await fetch(`${APP_URL}/pedidos/exportar`, { headers: { cookie: cookieAna } });
    const filas = filasCsv(await res.text());
    expect(filas).toHaveLength(await contarReal(almacen.id));
  });
});
