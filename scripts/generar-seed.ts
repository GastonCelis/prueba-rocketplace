/**
 * Spec 001 · T07 · RF-10
 * Genera supabase/seed.sql con datos de prueba deterministas (misma semilla ⇒ mismo archivo).
 *
 *   npm run seed:generar   →  escribe supabase/seed.sql
 *   npm run db:reset       →  aplica migraciones + seed
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const PASSWORD_DEMO = "Demo1234!";

type Tienda = { id: string; nombre: string; pedidos: number; usuarios: Usuario[] };
type Usuario = { id: string; email: string };

// IDs fijos: los tests pueden referirse a ellos sin consultar la base.
export const TIENDAS: Tienda[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    nombre: "Almacén Don Pepe",
    pedidos: 1240, // > 1000 (max_rows de la API) ⇒ CA-11
    usuarios: [
      { id: "a1111111-1111-4111-8111-111111111111", email: "ana@donpepe.test" },
      { id: "a2222222-2222-4222-8222-222222222222", email: "bruno@donpepe.test" },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    nombre: "Librería La Pluma",
    pedidos: 237, // no múltiplo de 50 ⇒ última página incompleta (CA-07)
    usuarios: [
      { id: "b1111111-1111-4111-8111-111111111111", email: "carla@lapluma.test" },
      { id: "b2222222-2222-4222-8222-222222222222", email: "diego@lapluma.test" },
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    nombre: "Ferretería El Tornillo",
    pedidos: 95,
    usuarios: [
      { id: "c1111111-1111-4111-8111-111111111111", email: "elena@eltornillo.test" },
      { id: "c2222222-2222-4222-8222-222222222222", email: "fede@eltornillo.test" },
    ],
  },
];

// Usuario sin tienda asignada ⇒ CA-03.
export const USUARIO_SIN_TIENDA: Usuario = {
  id: "d1111111-1111-4111-8111-111111111111",
  email: "sintienda@demo.test",
};

const ESTADOS = [
  ["pendiente", 15],
  ["pagado", 25],
  ["enviado", 20],
  ["entregado", 30],
  ["cancelado", 10],
] as const;

const NOMBRES = ["Juan", "María", "José", "Lucía", "Martín", "Sofía", "Agustín", "Valentina", "Tomás", "Camila", "Nicolás", "Florencia", "Ramón", "Inés", "Joaquín", "Belén"];
const APELLIDOS = ["Pérez", "González", "Rodríguez", "Fernández", "López", "Martínez", "Gómez", "Díaz", "Núñez", "Peña", "Muñoz", "Sánchez", "Álvarez", "Romero", "Ibáñez", "Ordóñez"];
// Casos que obligan a escapar bien el CSV (CA-13).
const CLIENTES_ESPECIALES = ['Pérez; Juan', 'María "Mery" Núñez', "Ñandú, S.A.", "O'Higgins Ltda."];

/** Generador pseudoaleatorio con semilla (mulberry32): mismo resultado en cada ejecución. */
function crearAleatorio(semilla: number) {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sql = (texto: string) => `'${texto.replaceAll("'", "''")}'`;

export function generarSeed(): string {
  const azar = crearAleatorio(20261022);
  const elegir = <T,>(lista: readonly T[]) => lista[Math.floor(azar() * lista.length)];
  const elegirEstado = () => {
    let r = azar() * 100;
    for (const [estado, peso] of ESTADOS) {
      if ((r -= peso) < 0) return estado;
    }
    return ESTADOS[0][0];
  };

  const desde = Date.UTC(2026, 0, 1);
  const hasta = Date.UTC(2026, 9, 15);
  const lineas: string[] = [
    "-- ARCHIVO GENERADO por scripts/generar-seed.ts. No editar a mano: `npm run seed:generar`.",
    `-- Contraseña de todos los usuarios: ${PASSWORD_DEMO}`,
    "",
    "-- Usuarios (Supabase Auth local)",
  ];

  const usuarios = [...TIENDAS.flatMap((t) => t.usuarios), USUARIO_SIN_TIENDA];
  for (const u of usuarios) {
    lineas.push(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)`,
      `values ('00000000-0000-0000-0000-000000000000', ${sql(u.id)}, 'authenticated', 'authenticated', ${sql(u.email)}, extensions.crypt(${sql(PASSWORD_DEMO)}, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');`,
      `insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)`,
      `values (gen_random_uuid(), ${sql(u.id)}, ${sql(u.id)}, jsonb_build_object('sub', ${sql(u.id)}, 'email', ${sql(u.email)}, 'email_verified', true), 'email', now(), now(), now());`,
    );
  }

  lineas.push("", "-- Tiendas");
  lineas.push(
    `insert into public.stores (id, name) values\n${TIENDAS.map((t) => `  (${sql(t.id)}, ${sql(t.nombre)})`).join(",\n")};`,
  );

  lineas.push("", "-- Pertenencia usuario → tienda (el usuario sin tienda no aparece)");
  lineas.push(
    `insert into public.store_members (user_id, store_id) values\n${TIENDAS.flatMap((t) =>
      t.usuarios.map((u) => `  (${sql(u.id)}, ${sql(t.id)})`),
    ).join(",\n")};`,
  );

  lineas.push("", "-- Pedidos");
  for (const tienda of TIENDAS) {
    const filas: string[] = [];
    for (let numero = 1; numero <= tienda.pedidos; numero++) {
      const cliente =
        numero % 97 === 0 ? CLIENTES_ESPECIALES[(numero / 97) % CLIENTES_ESPECIALES.length] : `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`;
      const total = (Math.round((500 + azar() * 249_500) * 100) / 100).toFixed(2);
      const fecha = new Date(desde + Math.floor(azar() * (hasta - desde))).toISOString();
      filas.push(`  (${sql(tienda.id)}, ${numero}, ${sql(cliente)}, '${elegirEstado()}', ${total}, '${fecha}')`);
    }
    // Lotes de 500 filas por sentencia para no generar un INSERT gigante.
    for (let i = 0; i < filas.length; i += 500) {
      lineas.push(
        `insert into public.orders (store_id, number, customer_name, status, total, created_at) values\n${filas.slice(i, i + 500).join(",\n")};`,
      );
    }
  }

  return lineas.join("\n") + "\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const destino = fileURLToPath(new URL("../supabase/seed.sql", import.meta.url));
  writeFileSync(destino, generarSeed(), "utf8");
  console.log(`seed.sql generado: ${TIENDAS.reduce((s, t) => s + t.pedidos, 0)} pedidos en ${TIENDAS.length} tiendas.`);
}
