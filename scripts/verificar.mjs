// `npm run verificar`: comprueba de punta a punta que todo funciona (Spec 001 · T16).
// Pasos: Supabase local → .env.local → reset de base con seed → typecheck → tests unitarios →
//        tests de RLS → tests de integración → build → app levantada + tests HTTP.
// Termina con un resumen y código de salida ≠ 0 si algo falla.
import { spawn, spawnSync } from "node:child_process";

const PUERTO_APP = 3100;
const resultados = [];

function correr(nombre, comando, env = {}) {
  console.log(`\n▶ ${nombre}\n  $ ${comando}`);
  const inicio = Date.now();
  const { status } = spawnSync(comando, { stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  const ok = status === 0;
  resultados.push({ nombre, ok, segundos: ((Date.now() - inicio) / 1000).toFixed(1) });
  return ok;
}

function resumenYSalir() {
  console.log("\n══════════ Resumen de verificación ══════════");
  for (const r of resultados) console.log(`${r.ok ? "✔" : "✘"} ${r.nombre.padEnd(38)} ${r.segundos}s`);
  const fallos = resultados.filter((r) => !r.ok).length;
  console.log(fallos ? `\n${fallos} paso(s) fallaron.` : "\nTodo OK.");
  process.exit(fallos ? 1 : 0);
}

async function esperarApp(url, segundos = 60) {
  for (let i = 0; i < segundos; i++) {
    try {
      await fetch(url, { redirect: "manual" });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

// 1. Supabase local (Docker). Si no está corriendo, se levanta.
const estado = spawnSync("npx supabase status", { shell: true, stdio: "ignore" });
if (estado.status !== 0 && !correr("Levantar Supabase local (Docker)", "npx supabase start")) resumenYSalir();

// 2-3. Configuración y base limpia con datos de prueba.
if (!correr("Escribir .env.local", "node scripts/env-local.mjs")) resumenYSalir();
if (!correr("Reset de base (migraciones + seed)", "npx supabase db reset")) resumenYSalir();
process.loadEnvFile(".env.local");

// 4-7. Tipos y tests.
correr("Typecheck", "npx tsc --noEmit");
correr("Tests unitarios (CA-09,10,12,13)", "npx vitest run tests/unit");
correr("Tests de RLS en Postgres (CA-01…06)", "npx vitest run tests/db");
correr("Tests de integración API (CA-01,04,07,08,11,13)", "npx vitest run tests/integration/pedidos.test.ts");

// 8-9. Build y prueba HTTP con la app levantada.
if (correr("Build de producción", "npx next build")) {
  console.log(`\n▶ Levantando la app en http://localhost:${PUERTO_APP}`);
  const app = spawn(`npx next start -p ${PUERTO_APP}`, { shell: true, stdio: "ignore", detached: process.platform !== "win32" });
  const appUrl = `http://localhost:${PUERTO_APP}`;
  if (await esperarApp(`${appUrl}/login`)) {
    correr("Tests HTTP con la app (CA-08,10,11,12,14)", "npx vitest run tests/integration/exportar-http.test.ts", { APP_URL: appUrl });
  } else {
    resultados.push({ nombre: "Levantar la app", ok: false, segundos: "-" });
  }
  // Apagar la app (en Windows hay que matar el árbol de procesos).
  if (process.platform === "win32") spawnSync(`taskkill /pid ${app.pid} /T /F`, { shell: true, stdio: "ignore" });
  else {
    try {
      process.kill(-app.pid);
    } catch {}
  }
}

resumenYSalir();
