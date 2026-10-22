-- Spec 001 · T05 · RF-01
-- Tiendas, pertenencia usuario → tienda y pedidos.

create type public.order_status as enum ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado');

create table public.stores (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- user_id es la clave primaria: un usuario pertenece a una sola tienda.
create table public.store_members (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade
);

create index store_members_store_id_idx on public.store_members (store_id);

create table public.orders (
  id            bigint generated always as identity primary key,
  store_id      uuid not null references public.stores (id) on delete cascade,
  number        integer not null,
  customer_name text not null,
  status        public.order_status not null,
  total         numeric(12, 2) not null check (total >= 0),
  created_at    timestamptz not null default now(),
  unique (store_id, number)
);

-- Coinciden con: filtro de RLS (store_id) + filtro opcional por estado + orden del listado.
create index orders_store_created_idx        on public.orders (store_id, created_at desc, id desc);
create index orders_store_status_created_idx on public.orders (store_id, status, created_at desc, id desc);
