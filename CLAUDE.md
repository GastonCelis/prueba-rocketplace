# CLAUDE.md

@AGENTS.md

## Notas específicas para Claude

- Antes de tocar código, leer la spec vigente en `specs/` y ubicar qué `RF`/`CA` afecta el cambio. Si el pedido no está cubierto, proponer primero la modificación de `spec.md`.
- Para cualquier cambio en `supabase/migrations/` o en `lib/pedidos.ts`, correr `npm run test:db` y `npm run test:integration` antes de darlo por terminado.
- Al terminar una tarea, correr `npm run verificar` y reportar el resultado real (qué pasó y qué no), sin resumirlo como éxito si algo falló o no se pudo ejecutar.
- Explicar el porqué de cada decisión al usuario: está aprendiendo mientras trabaja.
- Ceñirse a lo pedido: no agregar funcionalidad que no esté en la spec.
- No ejecutar `git commit`, `git push` ni `git merge` salvo pedido explícito.
