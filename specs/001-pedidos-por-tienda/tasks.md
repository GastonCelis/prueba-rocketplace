# Tareas — Spec 001

> Orden de ejecución. Cada tarea indica qué requisito/criterio cubre. Se marca `[x]` solo cuando su verificación pasa.

## Fase 0 — Especificación
- [x] T01 Escribir `spec.md` (HU, RF, CA, contrato CSV).
- [x] T02 Escribir `plan.md` (decisiones, modelo, RLS, matriz de tests).
- [x] T03 Escribir `AGENTS.md` y `CLAUDE.md` con el flujo SDD y las reglas del repo.

## Fase 1 — Base de datos
- [x] T04 `supabase/config.toml` para Supabase local (sin proyecto remoto). — RF-01
- [x] T05 Migración: tablas, enum, índices. — RF-01
- [x] T06 Migración: RLS, función `private.current_store_id()`, revocación de escrituras. — RF-07, RF-08
- [x] T07 `scripts/generar-seed.ts` → `supabase/seed.sql` determinista (tiendas, usuarios, pedidos). — RF-10

## Fase 2 — Tests primero
- [x] T08 `tests/db/rls.test.ts`. — CA-01…CA-06
- [x] T09 `tests/unit/filtros.test.ts` y `tests/unit/csv.test.ts`. — CA-09, CA-10, CA-12, CA-13
- [x] T10 `tests/integration/*.test.ts` — ejecutados contra Supabase local real (ver registro 2026-10-22 b). — CA-01, CA-04, CA-07, CA-08, CA-10…CA-14

## Fase 3 — Aplicación
- [x] T11 Clientes Supabase (`lib/supabase/*`) y `proxy.ts` para refrescar sesión. — RF-09
- [x] T12 `/login` con email y contraseña. — RF-09
- [x] T13 `lib/filtros.ts`, `lib/pedidos.ts`, `lib/csv.ts`. — RF-02…RF-06
- [x] T14 `/pedidos`: tabla, filtro por estado en URL, paginación de 50. — RF-02…RF-04
- [x] T15 `/pedidos/exportar`: CSV en streaming por lotes. — RF-05, RF-06

## Fase 4 — Verificación
- [x] T16 `scripts/verificar.mjs` (`npm run verificar`) que corre todo.
- [x] T17 Correr `npm run verificar` completo en una máquina con Docker y registrar el resultado.

## Registro de verificación

**2026-10-22 (b) — Supabase local real en Docker. `npm run verificar` → "Todo OK":**

| Paso | Resultado |
|---|---|
| Reset de base (migraciones + seed) | ✔ |
| Typecheck | ✔ |
| Tests unitarios | ✔ |
| Tests de RLS en Postgres (CA-01…06) | ✔ |
| Tests de integración API (CA-01,04,07,08,11,13) | ✔ |
| Build de producción | ✔ |
| Tests HTTP con la app (CA-08,10,11,12,14) | ✔ (5/5) |
| Navegador (Playwright), con `ana@donpepe.test`: login, 50 filas, filtro `pagado` + paginación que conserva el estado, `?estado=xyz&pagina=-3` → todos/pág. 1, CSV filtrado de 311 filas, sin errores de red | ✔ |

Hallazgos de esta corrida (corregidos en `supabase/config.toml`):
- `[auth.email] enable_signup = false` apagaba el proveedor de email entero (`Email logins are disabled`). Ahora el registro se cierra con `[auth] enable_signup = false` y el proveedor de email queda activo.
- Los puertos por defecto (54321-54327) chocaban con otro proyecto de Supabase local; este proyecto usa la serie 553xx.
- Pendiente cosmético fuera de la spec: `/favicon.ico` responde 404.

**Registro anterior (entorno sin Docker):**

**2026-10-22 — entorno del agente (sin acceso a los registros de imágenes de Docker, por lo que no pudo levantar Supabase local):**

| Paso | Resultado |
|---|---|
| Typecheck (`tsc --noEmit`) | ✔ |
| Tests unitarios (16) | ✔ |
| Migraciones + seed aplicados en Postgres 16 con una emulación mínima de `auth`/roles de Supabase | ✔ (1240 / 237 / 95 pedidos) |
| Tests de RLS (7) contra ese Postgres | ✔ — y fallan como corresponde si se desactiva RLS (prueba de que detectan el problema) |
| `next build` | ✔ |
| App sin sesión: `/pedidos/exportar` → 401, `/pedidos` → 307 a `/login` | ✔ (curl) |
| Tests de integración API y HTTP con sesión | ⏳ Pendiente: necesitan Supabase local real (`npm run verificar`) |
| Seed determinista (mismo hash en dos generaciones) | ✔ |
