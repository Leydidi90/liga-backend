-- Tabla principal de clientes SaaS (ligas/inquilinos)
create table if not exists tenant (
    id uuid primary key,
    nombre_liga text not null,
    subdominio_o_slug text not null unique,
    fecha_registro timestamptz not null default now(),
    estatus_pago boolean not null default false,
    plan text not null check (plan in ('Bronce', 'Plata', 'Oro')),
    fecha_vencimiento timestamptz not null default now(),
    dueno_nombre text not null,
    dueno_email text not null,
    password text not null
);

create index if not exists idx_tenant_slug on tenant (subdominio_o_slug);
create index if not exists idx_tenant_estatus_pago on tenant (estatus_pago);
