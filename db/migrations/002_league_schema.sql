-- Esquema completo de datos de liga (equipos, torneos, partidos, etc.)

create table if not exists equipo (
    id uuid primary key,
    tenant_id uuid not null references tenant(id) on delete cascade,
    nombre text not null,
    delegado text default '',
    escudo text default '',
    puntos integer not null default 0,
    partidos_jugados integer not null default 0,
    partidos_ganados integer not null default 0,
    partidos_empatados integer not null default 0,
    partidos_perdidos integer not null default 0,
    goles_favor integer not null default 0,
    goles_contra integer not null default 0
);

create index if not exists idx_equipo_tenant on equipo (tenant_id);

create table if not exists torneo (
    id uuid primary key,
    tenant_id uuid not null references tenant(id) on delete cascade,
    nombre text not null,
    categoria text not null,
    formato text default 'Liga (Todos contra todos)',
    fecha_inicio date,
    fecha_fin date,
    estatus text default 'En Registro',
    premio text default '',
    cobros jsonb not null default '{"costo_total": 0}'::jsonb
);

create index if not exists idx_torneo_tenant on torneo (tenant_id);

create table if not exists arbitro (
    id uuid primary key,
    tenant_id uuid not null references tenant(id) on delete cascade,
    nombre text not null,
    rol text default 'Central',
    matricula text not null,
    categoria text default '',
    equipo_id uuid references equipo(id) on delete set null
);

create index if not exists idx_arbitro_tenant on arbitro (tenant_id);
create index if not exists idx_arbitro_matricula on arbitro (matricula);

create table if not exists cancha (
    id uuid primary key,
    tenant_id uuid not null references tenant(id) on delete cascade,
    nombre text not null,
    direccion text default '',
    tipo_superficie text default 'Sintética',
    capacidad integer,
    notas text default '',
    activa boolean not null default true,
    fecha_registro timestamptz not null default now()
);

create index if not exists idx_cancha_tenant on cancha (tenant_id);

create table if not exists representante (
    id uuid primary key,
    tenant_id uuid not null references tenant(id) on delete cascade,
    nombre_representante text not null,
    email text not null,
    password text not null,
    equipo_principal text default '',
    fecha_registro timestamptz not null default now()
);

create index if not exists idx_representante_tenant on representante (tenant_id);
create index if not exists idx_representante_email on representante (tenant_id, email);

create table if not exists inscripcion (
    id uuid primary key,
    tenant_id uuid not null references tenant(id) on delete cascade,
    torneo_id uuid not null references torneo(id) on delete cascade,
    representante_id uuid not null references representante(id) on delete cascade,
    nombre_equipo text not null,
    uniforme jsonb not null default '{}'::jsonb,
    jugadores jsonb not null default '[]'::jsonb,
    desglose_cobro jsonb not null default '{}'::jsonb,
    total_cobro numeric(12, 2) not null default 0,
    pago jsonb not null default '{}'::jsonb,
    estatus_pago text default 'Pendiente',
    fecha_registro timestamptz not null default now()
);

create index if not exists idx_inscripcion_tenant on inscripcion (tenant_id);
create index if not exists idx_inscripcion_torneo on inscripcion (torneo_id);

create table if not exists partido (
    id uuid primary key,
    tenant_id uuid not null references tenant(id) on delete cascade,
    jornada integer not null default 1,
    fase text,
    equipo_local_id uuid references equipo(id) on delete set null,
    equipo_visitante_id uuid references equipo(id) on delete set null,
    goles_local integer not null default 0,
    goles_visitante integer not null default 0,
    estatus text not null default 'Pendiente',
    stats jsonb,
    sede text,
    horario text,
    arbitro_id uuid references arbitro(id) on delete set null
);

create index if not exists idx_partido_tenant on partido (tenant_id);
create index if not exists idx_partido_jornada on partido (tenant_id, jornada);

create table if not exists multa (
    id uuid primary key,
    tenant_id uuid not null references tenant(id) on delete cascade,
    tipo text not null default 'equipo',
    equipo_nombre text not null,
    jugador_nombre text,
    motivo text not null,
    monto numeric(12, 2) not null,
    jornada integer,
    arbitro_id uuid references arbitro(id) on delete set null,
    arbitro_nombre text,
    estatus text not null default 'Pendiente',
    fecha timestamptz not null default now()
);

create index if not exists idx_multa_tenant on multa (tenant_id);
