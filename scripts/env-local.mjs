// Escribe .env.local con las URLs y claves de Supabase LOCAL (lee `supabase status -o env`).
// Se niega a escribir si la URL no apunta a la máquina local: este proyecto no usa Supabase remoto.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

let salida;
try {
  salida = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch {
  console.error("Supabase local no está corriendo. Ejecutá primero `npm run db:start` (requiere Docker).");
  process.exit(1);
}

const valores = Object.fromEntries(
  salida
    .split(/\r?\n/)
    .map((linea) => linea.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map(([, clave, valor]) => [clave, valor]),
);

const env = {
  NEXT_PUBLIC_SUPABASE_URL: valores.API_URL,
  // Versiones nuevas del CLI exponen también PUBLISHABLE_KEY / SECRET_KEY.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: valores.ANON_KEY ?? valores.PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: valores.SERVICE_ROLE_KEY ?? valores.SECRET_KEY,
  DATABASE_URL: valores.DB_URL,
};

const faltantes = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
if (faltantes.length) {
  console.error(`No se encontraron en \`supabase status\`: ${faltantes.join(", ")}`);
  process.exit(1);
}

const esLocal = (url) => /^(https?|postgresql):\/\/([^@/]*@)?(127\.0\.0\.1|localhost)(:\d+)?/.test(url);
if (!esLocal(env.NEXT_PUBLIC_SUPABASE_URL) || !esLocal(env.DATABASE_URL)) {
  console.error("Las URLs no son locales. Este proyecto solo trabaja con Supabase local en Docker.");
  process.exit(1);
}

writeFileSync(
  ".env.local",
  [
    "# Generado por `npm run env:local` a partir de Supabase LOCAL. No commitear.",
    ...Object.entries(env).map(([k, v]) => `${k}=${v}`),
    "",
  ].join("\n"),
);
console.log(".env.local escrito con la configuración de Supabase local.");
