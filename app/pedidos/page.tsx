// RF-02, RF-03, RF-04: listado de 50 en 50 con filtro por estado en la URL.
import Link from "next/link";
import { redirect } from "next/navigation";
import { cerrarSesion } from "@/app/login/acciones";
import { formatearFecha } from "@/lib/csv";
import { ESTADOS, ETIQUETAS_ESTADO, TAMANO_PAGINA } from "@/lib/dominio";
import { leerFiltros, urlExportar, urlListado } from "@/lib/filtros";
import { listarPedidos } from "@/lib/pedidos";
import { crearClienteServidor } from "@/lib/supabase/server";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default async function Pedidos({ searchParams }: Props) {
  const filtros = leerFiltros(await searchParams);
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Ni acá ni en listarPedidos se filtra por tienda: RLS solo devuelve la tienda del usuario.
  const [{ data: tienda }, { pedidos, total, totalPaginas }] = await Promise.all([
    supabase.from("stores").select("name").maybeSingle(),
    listarPedidos(supabase, filtros),
  ]);

  const { estado, pagina } = filtros;
  const primera = pedidos.length === 0 ? 0 : (pagina - 1) * TAMANO_PAGINA + 1;
  const ultima = pedidos.length === 0 ? 0 : primera + pedidos.length - 1;

  return (
    <main>
      <header className="encabezado">
        <div>
          <h1>Pedidos</h1>
          <p className="tienda">{tienda?.name ?? "Tu usuario no tiene una tienda asignada."}</p>
        </div>
        <form action={cerrarSesion}>
          <span className="usuario">{user.email}</span>
          <button type="submit">Salir</button>
        </form>
      </header>

      <div className="barra">
        {/* method="get": el navegador pone ?estado= en la URL y descarta la página (vuelve a la 1). */}
        <form method="get" action="/pedidos">
          <label>
            Estado{" "}
            <select name="estado" defaultValue={estado ?? ""}>
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETAS_ESTADO[e]}
                </option>
              ))}
            </select>
          </label>{" "}
          <button type="submit">Filtrar</button>
        </form>
        {/* <a> y no <Link>: es una descarga, no una navegación. */}
        <a className="boton" href={urlExportar(estado)}>
          Descargar CSV ({total})
        </a>
      </div>

      <table>
        <thead>
          <tr>
            <th>N.º</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th className="numero">Total</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id}>
              <td>{p.number}</td>
              <td>{formatearFecha(p.created_at)}</td>
              <td>{p.customer_name}</td>
              <td>{ETIQUETAS_ESTADO[p.status]}</td>
              <td className="numero">{moneda.format(p.total)}</td>
            </tr>
          ))}
          {pedidos.length === 0 && (
            <tr>
              <td colSpan={5} className="vacio">
                No hay pedidos para mostrar.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <nav className="paginacion" aria-label="Paginación">
        {pagina > 1 ? <Link href={urlListado({ estado, pagina: pagina - 1 })}>← Anterior</Link> : <span />}
        <span>
          {primera}–{ultima} de {total} · Página {pagina} de {Math.max(totalPaginas, 1)}
        </span>
        {pagina < totalPaginas ? <Link href={urlListado({ estado, pagina: pagina + 1 })}>Siguiente →</Link> : <span />}
      </nav>
    </main>
  );
}
