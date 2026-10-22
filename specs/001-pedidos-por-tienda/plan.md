# Plan técnico — Spec 001

> Responde **cómo** se cumple [`spec.md`](./spec.md). Cada decisión lleva su porqué.

## 1. Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Lenguaje | TypeScript (strict) | Pedido explícito. |
| Base de datos | Postgres de **Supabase local** (Docker, vía Supabase CLI) | Pedido explícito. Nunca se enlaza un proyecto remoto. |
| App | Next.js (App Router) + React | Server Components leen la base en el servidor con la sesión del usuario; los route handlers permiten emitir el CSV en streaming. |
| Cliente Supabase | `@supabase/ssr` + `@supabase/supabase-js` | Maneja la sesión en cookies para que cada consulta viaje con el JWT del usuario y Postgres aplique RLS. |
| Tests | Vitest + `pg` | Un único runner para tests unitarios, de base y de integración. |

## 2. Modelo de datos

```
stores (id uuid PK, name text unique, created_at)
store_members (user_id uuid PK → auth.users, store_id uuid → stores)   -- PK en user_id ⇒ una tienda por usuario
orders (id bigint identity PK, store_id uuid → stores, number int, customer_name text,
        status order_status, total numeric(12,2) ≥ 0, created_at timestamptz,
        UNIQUE (store_id, number))
order_status = enum('pendiente','pagado','enviado','entregado','cancelado')
```

Índices: `(store_id, created_at desc, id desc)` y `(store_id, status, created_at desc, id desc)`. Coinciden con el filtro implícito de RLS (`store_id`), el filtro de estado y el orden del listado, así Postgres resuelve página y conteo sin ordenar toda la tabla.

## 3. Seguridad: RLS (RF-07, RF-08)

- `private.current_store_id()` — función `security definer` que devuelve la tienda del usuario (`auth.uid()`). Vive en el esquema `private`, que **no** está expuesto por la API, así no se puede invocar desde afuera. Es `security definer` para leer `store_members` sin quedar atrapada en las políticas de esa misma tabla.
- `orders`: RLS habilitado, una única política `SELECT` para `authenticated`: `store_id = (select private.current_store_id())`. El `(select …)` hace que Postgres la calcule una sola vez por consulta y no una vez por fila.
- `stores`: `SELECT` solo de la propia tienda. `store_members`: `SELECT` solo de la propia fila.
- No hay políticas de `INSERT/UPDATE/DELETE` ⇒ RLS las niega. Además se revocan esos privilegios a `anon` y `authenticated` (defensa en profundidad), y `anon` no tiene ningún privilegio sobre las tablas.
- La app **nunca** usa la `service_role` key. Esa clave solo aparece en los tests de integración para calcular los totales reales con los que se compara.

Consecuencia: la app no agrega `.eq('store_id', …)` en ninguna consulta. Si alguien llama a la API REST directamente con su JWT, obtiene exactamente lo mismo que ve en pantalla.

## 4. Listado (RF-02, RF-03, RF-04)

- Ruta: `/pedidos?estado=&pagina=` (Server Component).
- `lib/filtros.ts` normaliza los parámetros (estado válido o `null`; página entero ≥ 1) y arma las URLs. Al ser funciones puras se testean sin base.
- `lib/pedidos.ts → listarPedidos(supabase, filtros)`: `select … , { count: 'exact' }` + `order(created_at desc, id desc)` + `range(offset, offset+49)`.
  - **Paginación por offset** (no por cursor): permite "página N de M" y enlaces directos a una página, que es lo que pide una URL compartible. El orden incluye `id` como desempate para que ninguna fila salte de página.
- Filtro: formulario HTML con `method="get"` ⇒ el navegador pone `?estado=` en la URL sin JavaScript y descarta `pagina` (vuelve a la 1).

## 5. Exportación CSV (RF-05, RF-06)

- Route handler `GET /pedidos/exportar?estado=` con el mismo cliente con sesión ⇒ RLS aplica igual.
- PostgREST devuelve como máximo `max_rows = 1000` filas por respuesta, así que `recorrerPedidos()` pide lotes de 1000 con el mismo orden estable que el listado hasta recibir un lote incompleto.
- La respuesta es un `ReadableStream`: se escribe cada lote apenas llega, sin juntar todo el archivo en memoria.
- `lib/csv.ts` (puro): BOM, `;`, `CRLF`, coma decimal, fecha en zona de Argentina, escapado RFC 4180.
- Limitación conocida: si se insertan pedidos **mientras** se descarga, un lote puede repetir una fila del anterior (offset). No ocurre en este alcance porque la app no permite insertar.

## 6. Autenticación (RF-09)

- Email + contraseña de Supabase Auth. Usuarios creados por el seed (no hay registro desde la app).
- `proxy.ts` (Next.js 16) refresca la sesión en cada request, que es lo que recomienda `@supabase/ssr`.
- `/pedidos` redirige a `/login` sin usuario; `/pedidos/exportar` responde 401. Esto es UX: aunque se omitiera, RLS seguiría devolviendo 0 filas.

## 7. Estrategia de tests y trazabilidad

| Nivel | Archivo | Requiere | Cubre |
|---|---|---|---|
| Unitario | `tests/unit/filtros.test.ts` | nada | CA-09, CA-10 |
| Unitario | `tests/unit/csv.test.ts` | nada | CA-12, CA-13 |
| Base (SQL directo, simulando el JWT como hace PostgREST) | `tests/db/rls.test.ts` | Postgres local | CA-01 a CA-06 |
| Integración (API real de Supabase con usuarios reales) | `tests/integration/pedidos.test.ts` | Supabase local | CA-01, CA-04, CA-07, CA-08, CA-11, CA-13 |
| HTTP (app levantada) | `tests/integration/exportar-http.test.ts` | Supabase local + `next start` | CA-08, CA-10, CA-11, CA-12, CA-14, RF-09 |

`npm run verificar` ejecuta todo en orden (ver README).

## 8. Datos de prueba (RF-10)

`scripts/generar-seed.ts` usa un generador pseudoaleatorio con semilla fija ⇒ siempre produce el mismo `supabase/seed.sql`. Volumen elegido para ejercitar los criterios:

| Tienda | Pedidos | Por qué |
|---|---|---|
| Almacén Don Pepe | 1240 | > 1000 para CA-11 (más que `max_rows`). |
| Librería La Pluma | 237 | No múltiplo de 50 ⇒ última página incompleta (CA-07). |
| Ferretería El Tornillo | 95 | Tienda chica para comparar. |

Nombres de clientes con acentos, ñ, `;`, comas y comillas para CA-13. Usuarios: dos por tienda y uno sin tienda (CA-03). Contraseña común: `Demo1234!`.
