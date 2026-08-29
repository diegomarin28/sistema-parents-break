-- Parents Break — Operations System
-- Schema as deployed to Supabase (Postgres 17). Run this against a fresh
-- Supabase project's SQL editor to reproduce the database.

create extension if not exists pgcrypto;

-- ============================================================
-- Tables
-- ============================================================

create table candidatas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text,
  telefono text,
  mail text,
  zona text,
  zona_sitting text,
  edad text,
  disponibilidad text,
  bachillerato text,
  universidad text,
  cocina text,
  idiomas text,
  licencia text,
  cambia_panales text,
  dispone_traslados text,
  disponible_tipo text,
  fechas_punta text,
  experiencia text,
  patologias text,
  trabaja_actualmente text,
  primeros_auxilios text,
  capacitacion_extra text,
  comentarios text,
  tipo text not null default 'Niñera' check (tipo in ('Niñera','Traslados','Ambas')),
  origen text,
  estado text not null default 'intake' check (estado in ('intake','entrevistada','contratada','descartada')),
  created_at timestamptz not null default now()
);

create table entrevistas (
  id uuid primary key default gen_random_uuid(),
  candidata_id uuid not null references candidatas(id) on delete cascade,
  fecha date,
  entrevisto text,
  rol text,
  puntajes jsonb not null default '{}'::jsonb,      -- { competencyKey: { score: 1-5, notes: text } }
  redflags jsonb not null default '{}'::jsonb,       -- { flagKey: boolean }
  referencias jsonb not null default '[]'::jsonb,    -- [{ name, phone, relacion, confirmado }]
  psico jsonb not null default '{}'::jsonb,           -- observation-guide answers, not a clinical instrument
  explicacion_juegos text,
  notas text,
  total numeric,
  recomendacion text,
  created_at timestamptz not null default now()
);

create table ninieras (
  id uuid primary key default gen_random_uuid(),
  candidata_id uuid references candidatas(id) on delete set null,
  nombre text not null,
  telefono text,
  zona text,
  tipo text default 'Niñera',
  foto text,
  cv_url text,
  notas text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table familias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  zona text,
  telefono text,
  ninos text,
  notas text,
  created_at timestamptz not null default now()
);

-- many-to-many familia <-> niñera, with a rate pair per relationship
create table asignaciones (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id) on delete cascade,
  ninera_id uuid references ninieras(id) on delete set null,
  ninera_nombre text not null,     -- denormalized fallback: rate can be recorded before the person is a formal `ninieras` row
  cobro_hora numeric,               -- billed to the family, per hour
  pago_hora numeric,                -- paid to the sitter, per hour
  created_at timestamptz not null default now()
);

create index on entrevistas (candidata_id);
create index on ninieras (candidata_id);
create index on asignaciones (familia_id);
create index on asignaciones (ninera_id);

-- ============================================================
-- Row Level Security
-- Every table is locked down by default: only authenticated
-- staff sessions (created manually in Supabase Auth, no
-- self-serve signup) can read or write anything. The
-- publishable/anon key is safe to ship in public client code
-- because it grants nothing on its own.
-- ============================================================

alter table candidatas   enable row level security;
alter table entrevistas  enable row level security;
alter table ninieras     enable row level security;
alter table familias     enable row level security;
alter table asignaciones enable row level security;

create policy "solo_autenticados_todo" on candidatas   for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "solo_autenticados_todo" on entrevistas   for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "solo_autenticados_todo" on ninieras      for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "solo_autenticados_todo" on familias      for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "solo_autenticados_todo" on asignaciones  for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
