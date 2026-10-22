# Pedidos multi-tienda

Listado de pedidos de varias tiendas que comparten una base Postgres (Supabase **local**). Cada usuario ve solo los pedidos de su tienda —lo garantiza Row Level Security en Postgres—, de 50 en 50, con filtro por estado en la URL y descarga CSV del conjunto filtrado completo, lista para Excel en español.

- Especificación (SDD): [`specs/001-pedidos-por-tienda/`](specs/001-pedidos-por-tienda/) → `spec.md`, `plan.md`, `tasks.md`
- Guía para agentes: [`AGENTS.md`](AGENTS.md) · [`CLAUDE.md`](CLAUDE.md)

## Requisitos

- Node.js 20.9 o superior
- Docker Desktop (o Docker Engine) corriendo

## Levantar el proyecto

```bash
npm install          # dependencias, incluye el CLI de Supabase
npm run db:start     # Supabase local en Docker: aplica migraciones y seed la primera vez
npm run env:local    # genera .env.local con la URL y claves locales
npm run dev          # http://localhost:3000
```

Para volver la base a cero (migraciones + datos de prueba): `npm run db:reset`.
Para apagar los contenedores: `npm run db:stop`. Studio local: http://127.0.0.1:55323

## Usuarios de prueba

Contraseña de todos: `Demo1234!`

| Usuario                                         | Tienda                  | Pedidos |
| ----------------------------------------------- | ----------------------- | ------- |
| `ana@donpepe.test`, `bruno@donpepe.test`        | Almacén Don Pepe        | 1240    |
| `carla@lapluma.test`, `diego@lapluma.test`      | Librería La Pluma       | 237     |
| `elena@eltornillo.test`, `fede@eltornillo.test` | Ferretería El Tornillo  | 95      |
| `sintienda@demo.test`                           | — (no ve ningún pedido) | 0       |

Los datos los genera `scripts/generar-seed.ts` con una semilla fija. Para regenerarlos: `npm run seed:generar && npm run db:reset`.

## Verificar que todo funciona

```bash
npm run verificar
```

Corre, en orden, y muestra un resumen ✔/✘ por paso:

1. Levanta Supabase local si no está corriendo y regenera `.env.local`.
2. `supabase db reset` (base limpia con datos de prueba).
3. Typecheck.
4. Tests unitarios — formato CSV y lectura de la URL (no usan base).
5. Tests de RLS directos en Postgres — aislamiento por tienda y bloqueo de escrituras.
6. Tests de integración contra la API de Supabase con usuarios reales — paginación, filtro, CSV > 1000 filas.
7. Build de producción, levanta la app en el puerto 3100 y prueba por HTTP la página y la descarga.

Cada test lleva en el nombre el criterio de aceptación que comprueba (`CA-xx`, ver `spec.md`).
También se pueden correr por separado: `npm run test:unit`, `npm run test:db`, `npm run test:integration`.

## Rutas

| Ruta                              | Qué hace                                |
| --------------------------------- | --------------------------------------- |
| `/login`                          | Inicio de sesión                        |
| `/pedidos?estado=pagado&pagina=2` | Listado filtrado y paginado             |
| `/pedidos/exportar?estado=pagado` | CSV con todos los pedidos de ese estado |
