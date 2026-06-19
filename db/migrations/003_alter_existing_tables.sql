-- Ajustes para proyectos Supabase con tablas parciales o antiguas

alter table if exists torneo add column if not exists categoria text;
alter table if exists torneo add column if not exists formato text default 'Liga (Todos contra todos)';
alter table if exists torneo add column if not exists fecha_inicio date;
alter table if exists torneo add column if not exists fecha_fin date;
alter table if exists torneo add column if not exists estatus text default 'En Registro';
alter table if exists torneo add column if not exists premio text default '';
alter table if exists torneo add column if not exists cobros jsonb not null default '{"costo_total": 0}'::jsonb;

alter table if exists equipo add column if not exists delegado text default '';
alter table if exists equipo add column if not exists escudo text default '';
alter table if exists equipo add column if not exists puntos integer not null default 0;
alter table if exists equipo add column if not exists partidos_jugados integer not null default 0;
alter table if exists equipo add column if not exists partidos_ganados integer not null default 0;
alter table if exists equipo add column if not exists partidos_empatados integer not null default 0;
alter table if exists equipo add column if not exists partidos_perdidos integer not null default 0;
alter table if exists equipo add column if not exists goles_favor integer not null default 0;
alter table if exists equipo add column if not exists goles_contra integer not null default 0;

alter table if exists partido add column if not exists fase text;
alter table if exists partido add column if not exists stats jsonb;
alter table if exists partido add column if not exists sede text;
alter table if exists partido add column if not exists horario text;
alter table if exists partido add column if not exists arbitro_id uuid;
