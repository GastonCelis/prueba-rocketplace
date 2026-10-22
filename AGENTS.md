# AGENTS.md

Guía para cualquier agente de IA (y persona) que trabaje en este repositorio.

## Qué es

Listado de pedidos multi-tienda: varias tiendas comparten una base Postgres (Supabase local). Cada usuario ve solo los pedidos de su tienda, de 50 en 50, con filtro por estado en la URL, y puede descargar en CSV (apto Excel en español) todo el conjunto filtrado.

Especificación vigente: [`specs/001-pedidos-por-tienda/`](specs/001-pedidos-por-tienda/).

## Metodología: Spec-Driven Development (SDD)

El código se deriva de la especificación, nunca al revés.

1. **Spec** (`spec.md`) — qué y cómo se comprueba: historias, requisitos `RF-xx`, criterios de aceptación `CA-xx`.
2. **Plan** (`plan.md`) — cómo: decisiones técnicas con su porqué, modelo de datos, matriz CA → test.
3. **Tasks** (`tasks.md`) — pasos ordenados y verificables, cada uno ligado a RF/CA.
4. **Implementación** — tests primero para cada CA, luego el código mínimo que los hace pasar.
5. **Verificación** — `npm run verificar` en verde antes de dar algo por terminado.

Reglas:
- Un cambio de comportamiento empieza modificando `spec.md` (y `plan.md` si cambia el cómo). Una funcionalidad nueva va en una spec nueva: `specs/00N-<nombre>/`.
- Todo `CA-xx` tiene al menos un test, y el nombre del test empieza con su ID (`it('CA-08 …')`).
- No implementar nada que no esté en la spec. Si falta algo, se propone en la spec primero.
- Marcar `[x]` en `tasks.md` solo cuando la verificación correspondiente pasa.

## Reglas no negociables

- **Solo Supabase local con Docker.** No ejecutar `supabase link`, `supabase db push`, ni usar URLs o claves de un proyecto remoto.
- **El aislamiento por tienda lo garantiza Postgres (RLS).** No agregar filtros por `store_id` en la app como "seguridad", ni usar la `service_role` key en código de la app (solo en tests, para calcular valores esperados).
- Toda tabla nueva en `public` nace con RLS habilitado y políticas explícitas en la misma migración.
- Los cambios de esquema van en una migración nueva en `supabase/migrations/`; nunca se edita una migración ya aplicada.
- Los datos de prueba salen de `scripts/generar-seed.ts`. No editar `supabase/seed.sql` a mano: se regenera con `npm run seed:generar`.
- **No crear commits, ni hacer push ni merge** salvo pedido explícito del usuario.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Dependencias (incluye el CLI de Supabase). |
| `npm run db:start` | Levanta Supabase local en Docker. |
| `npm run env:local` | Escribe `.env.local` con las URLs y claves locales. |
| `npm run db:reset` | Recrea la base: migraciones + `seed.sql`. |
| `npm run seed:generar` | Regenera `supabase/seed.sql`. |
| `npm run dev` | App en http://localhost:3000. |
| `npm run typecheck` | TypeScript sin emitir. |
| `npm run test:unit` | Tests unitarios (no necesitan base). |
| `npm run test:db` | Tests de RLS contra el Postgres local. |
| `npm run test:integration` | Tests contra la API de Supabase local. |
| `npm run verificar` | Todo lo anterior + build + test HTTP, en orden. |
| `npm run db:stop` | Apaga los contenedores. |

## Mapa del código

```
app/login/            Inicio de sesión (server action)
app/pedidos/          Listado (Server Component) y exportar/route.ts (CSV en streaming)
lib/filtros.ts        Lectura/armado de ?estado=&pagina= (puro)
lib/csv.ts            Formato CSV para Excel en español (puro)
lib/pedidos.ts        Consultas a orders (sin filtrar por tienda: lo hace RLS)
lib/exportacion.ts    Recorrido por lotes del conjunto filtrado para el CSV
lib/dominio.ts        Tipos y constantes del dominio (estados, tamaño de página)
lib/supabase/         Clientes de servidor y refresco de sesión
proxy.ts              Refresco de sesión en cada request
supabase/migrations/  Esquema y RLS
scripts/              Generador de seed, .env.local y verificación
tests/                unit / db / integration
```

## Convenciones

- Código, nombres de dominio y textos de UI en español; nombres de tablas y columnas en inglés.
- TypeScript `strict`. Funciones puras en `lib/` siempre que se pueda: son las más fáciles de testear.
- Las fechas se guardan en `timestamptz` (UTC) y se muestran en `America/Argentina/Buenos_Aires`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
