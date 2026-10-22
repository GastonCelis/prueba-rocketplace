/**
 * CA-01 … CA-06: el aislamiento por tienda lo garantiza Postgres.
 *
 * Se conecta directo al Postgres local y, dentro de una transacción, hace exactamente lo que hace
 * la API de Supabase con cada request: cambia al rol `authenticated` (o `anon`) y carga el JWT del
 * usuario en `request.jwt.claims`. Así se prueba la política tal cual, sin pasar por la app.
 * Cada caso termina con ROLLBACK: la base queda intacta.
 */
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TIENDAS, USUARIO_SIN_TIENDA } from "../../scripts/generar-seed";

const [almacen, libreria] = TIENDAS;
const ana = almacen.usuarios[0];

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
});

type Identidad = { rol: "authenticated"; sub: string } | { rol: "anon" };

/** Ejecuta `sql` como si fuera un request de la API con esa identidad. Devuelve filas o el error. */
async function como(identidad: Identidad, sql: string, params: unknown[] = []) {
  await db.query("begin");
  try {
    const claims = identidad.rol === "anon" ? { role: "anon" } : { role: "authenticated", sub: identidad.sub };
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await db.query(`set local role ${identidad.rol}`);
    const { rows, rowCount } = await db.query(sql, params);
    return { rows, rowCount, error: null as null | { code?: string } };
  } catch (error) {
    return { rows: [], rowCount: 0, error: error as { code?: string } };
  } finally {
    await db.query("rollback");
  }
}

const usuario = (sub: string): Identidad => ({ rol: "authenticated", sub });
/** Total real (consultado como superusuario, que ignora RLS). */
const totalReal = async (storeId: string) =>
  Number((await db.query("select count(*) from public.orders where store_id = $1", [storeId])).rows[0].count);

beforeAll(() => db.connect());
afterAll(() => db.end());

describe("RLS sobre orders", () => {
  it("CA-01 un usuario solo ve los pedidos de su tienda, y los ve todos", async () => {
    for (const tienda of TIENDAS) {
      for (const u of tienda.usuarios) {
        const { rows, error } = await como(usuario(u.id), "select store_id, count(*)::int as n from public.orders group by store_id");
        expect(error).toBeNull();
        expect(rows).toEqual([{ store_id: tienda.id, n: await totalReal(tienda.id) }]);
      }
    }
  });

  it("CA-02 pedir explícitamente otra tienda devuelve 0 filas", async () => {
    const { rows } = await como(usuario(ana.id), "select count(*)::int as n from public.orders where store_id = $1", [libreria.id]);
    expect(rows[0].n).toBe(0);
    expect(await totalReal(libreria.id)).toBeGreaterThan(0); // los datos existen, solo que no son visibles
  });

  it("CA-03 un usuario sin tienda no ve ningún pedido", async () => {
    const { rows } = await como(usuario(USUARIO_SIN_TIENDA.id), "select count(*)::int as n from public.orders");
    expect(rows[0].n).toBe(0);
  });

  it("CA-04 anónimo no obtiene filas", async () => {
    const { rows, error } = await como({ rol: "anon" }, "select * from public.orders limit 1");
    expect(rows).toHaveLength(0);
    expect(error?.code).toBe("42501"); // permission denied
  });

  it("CA-05 no se puede insertar, modificar ni borrar pedidos", async () => {
    const insertar = await como(
      usuario(ana.id),
      "insert into public.orders (store_id, number, customer_name, status, total) values ($1, 999999, 'x', 'pagado', 1)",
      [almacen.id],
    );
    const modificarPropio = await como(usuario(ana.id), "update public.orders set total = 0 where store_id = $1", [almacen.id]);
    const modificarAjeno = await como(usuario(ana.id), "update public.orders set total = 0 where store_id = $1", [libreria.id]);
    const borrar = await como(usuario(ana.id), "delete from public.orders");

    for (const intento of [insertar, modificarPropio, modificarAjeno, borrar]) {
      expect(intento.error?.code).toBe("42501");
      expect(intento.rowCount).toBe(0);
    }
  });

  it("CA-06 no se puede cambiar de tienda ni asignarse una", async () => {
    const cambiar = await como(usuario(ana.id), "update public.store_members set store_id = $1 where user_id = $2", [libreria.id, ana.id]);
    const asignarse = await como(usuario(USUARIO_SIN_TIENDA.id), "insert into public.store_members (user_id, store_id) values ($1, $2)", [
      USUARIO_SIN_TIENDA.id,
      almacen.id,
    ]);
    expect(cambiar.error?.code).toBe("42501");
    expect(asignarse.error?.code).toBe("42501");
  });

  it("RF-07 stores y store_members también exponen solo lo propio", async () => {
    const tiendas = await como(usuario(ana.id), "select id from public.stores");
    const miembros = await como(usuario(ana.id), "select user_id from public.store_members");
    expect(tiendas.rows).toEqual([{ id: almacen.id }]);
    expect(miembros.rows).toEqual([{ user_id: ana.id }]);
  });
});
