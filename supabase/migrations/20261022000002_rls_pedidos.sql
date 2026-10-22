-- Spec 001 · T06 · RF-07, RF-08
-- El aislamiento por tienda lo aplica Postgres, no la aplicación.

-- 1. Tienda del usuario actual.
--    Esquema `private`: no está expuesto por la API REST, así que nadie puede llamarla desde afuera.
--    security definer: lee store_members con los permisos del dueño, sin depender de las políticas
--    de esa misma tabla (evita recursión y que el usuario necesite permisos extra).
--    search_path vacío: obliga a calificar nombres y evita que alguien "inyecte" otro objeto homónimo.
create schema if not exists private;

create function private.current_store_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select store_id
  from public.store_members
  where user_id = (select auth.uid())
$$;

revoke all on function private.current_store_id() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_store_id() to authenticated;

-- 2. RLS habilitado en todas las tablas del dominio.
alter table public.stores        enable row level security;
alter table public.store_members enable row level security;
alter table public.orders        enable row level security;

-- 3. Solo lectura, y solo de lo propio.
--    `(select ...)` hace que Postgres evalúe la función una vez por consulta y no una vez por fila.
create policy "orders: leer los de mi tienda"
  on public.orders for select
  to authenticated
  using (store_id = (select private.current_store_id()));

create policy "stores: leer mi tienda"
  on public.stores for select
  to authenticated
  using (id = (select private.current_store_id()));

create policy "store_members: leer mi pertenencia"
  on public.store_members for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 4. Defensa en profundidad: además de no tener políticas de escritura (RLS las niega),
--    se quitan los privilegios que Supabase otorga por defecto.
revoke all on public.stores, public.store_members, public.orders from anon;
revoke insert, update, delete, truncate on public.stores, public.store_members, public.orders from authenticated;
