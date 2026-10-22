// Carga .env.local (lo escribe `npm run env:local`) para los tests de base e integración.
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
