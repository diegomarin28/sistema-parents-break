-- ============================================================================
-- Parents Break: estructura de la base (Supabase, proyecto "Parents-break",
-- Postgres 17). SOLO ESTRUCTURA, sin datos.
--
-- Foto tomada de producción el 04/10/2026 leyendo el catálogo de Postgres (solo
-- lectura), más la migración supabase/migraciones/20261005_vigencia_fijos_historial_sittings.sql
-- (vigencia y tipo de asignaciones, historial de sittings, cierre de candidatas-fotos).
--
-- El historial paso a paso son las 79 migraciones registradas en el proyecto
-- (supabase_migrations.schema_migrations). No se copiaron acá porque varias cargan
-- datos reales (nombres, cuentas bancarias). Cuando se cambie la estructura, actualizar
-- este archivo en el mismo PR.
--
-- Sirve para levantar un proyecto de prueba vacío con la misma forma que producción.
-- Pasos aparte (no son SQL): crear los usuarios en Authentication, desplegar las Edge
-- Functions y cargar los secretos (app_secrets / Vault).
--
-- Edge Functions desplegadas (código NO versionado en este repo todavía), todas con
-- verify_jwt = false:
--   candidatas-webhook, resenas-webhook, carsitting-webhook, carsitting-recordatorio,
--   whatsapp-webhook, enviar-push-urgentes, temporada-ninera
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ----------------------------------------------------------------------------
-- Tablas
-- ----------------------------------------------------------------------------

create table public.app_config (
  id text not null,
  valor jsonb default '{}'::jsonb not null,
  actualizado_at timestamp with time zone default now() not null,
  constraint app_config_pkey PRIMARY KEY (id)
);

-- Secretos que leen las Edge Functions. RLS activo y sin políticas: la app no la ve.
create table public.app_secrets (
  clave text not null,
  valor text not null,
  constraint app_secrets_pkey PRIMARY KEY (clave)
);

create table public.asignaciones (
  id uuid default gen_random_uuid() not null,
  familia_id uuid not null,
  ninera_id uuid,
  ninera_nombre text not null,
  cobro_hora numeric,
  pago_hora numeric,
  created_at timestamp with time zone default now() not null,
  dias jsonb default '[]'::jsonb not null,
  hora_inicio time without time zone,
  hora_fin time without time zone,
  -- Vigencia del fijo, ambos extremos inclusive (hasta vacío = sigue vigente). La Agenda
  -- solo lo dibuja dentro de estas fechas; cambiar de niñera cierra una y abre otra.
  vigente_desde date default ((now() at time zone 'America/Montevideo')::date),
  vigente_hasta date,
  tipo text default 'sitting'::text,
  constraint asignaciones_pkey PRIMARY KEY (id),
  constraint asignaciones_tipo_check CHECK (((tipo IS NULL) OR (tipo = ANY (ARRAY['sitting'::text, 'traslado'::text])))),
  constraint asignaciones_vigencia_check CHECK (((vigente_hasta IS NULL) OR (vigente_desde IS NULL) OR (vigente_hasta >= vigente_desde)))
);

create table public.candidatas (
  id uuid default gen_random_uuid() not null,
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
  tipo text default 'Niñera'::text not null,
  origen text,
  estado text default 'intake'::text not null,
  created_at timestamp with time zone default now() not null,
  foto_url text,
  autoriza_foto boolean,
  carsitting_mail_enviado_at timestamp with time zone,
  fecha_nacimiento date,
  cuenta_bancaria text,
  notas_ficha jsonb default '{}'::jsonb not null,
  temporada_quincenas smallint[],
  zona_barrios text,
  zona_sitting_barrios text,
  constraint candidatas_pkey PRIMARY KEY (id),
  constraint candidatas_estado_check CHECK ((estado = ANY (ARRAY['intake'::text, 'entrevistada'::text, 'contratada'::text, 'descartada'::text]))),
  constraint candidatas_tipo_check CHECK ((tipo = ANY (ARRAY['Niñera'::text, 'Traslados'::text, 'Ambas'::text])))
);

create table public.carsitting_datos (
  id uuid default gen_random_uuid() not null,
  ninera_id uuid,
  ninera_nombre text,
  nombre_completo text,
  cedula text,
  modelo_auto text,
  padron text,
  compania_seguro text,
  tipo_seguro text,
  cantidad_asientos text,
  cantidad_cinturones text,
  anio_fabricacion text,
  color_auto text,
  matricula text,
  numero_licencia text,
  anio_licencia text,
  libreta_propiedad text,
  foto_licencia_url text,
  foto_libreta_url text,
  foto_asientos_url text,
  created_at timestamp with time zone default now() not null,
  constraint carsitting_datos_pkey PRIMARY KEY (id)
);

create table public.contratos (
  id uuid default gen_random_uuid() not null,
  tipo text not null,
  parte_nombre text not null,
  fecha date,
  estado text default 'borrador'::text not null,
  notas text,
  created_at timestamp with time zone default now(),
  constraint contratos_pkey PRIMARY KEY (id),
  constraint contratos_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'enviado'::text, 'firmado'::text]))),
  constraint contratos_tipo_check CHECK ((tipo = ANY (ARRAY['ninera'::text, 'traslado'::text])))
);

create table public.entrevista_preguntas (
  id uuid default gen_random_uuid() not null,
  competencia_key text not null,
  texto text not null,
  orden integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  constraint entrevista_preguntas_pkey PRIMARY KEY (id)
);

create table public.entrevistas (
  id uuid default gen_random_uuid() not null,
  candidata_id uuid not null,
  fecha date,
  entrevisto text,
  rol text,
  puntajes jsonb default '{}'::jsonb not null,
  redflags jsonb default '{}'::jsonb not null,
  referencias jsonb default '[]'::jsonb not null,
  psico jsonb default '{}'::jsonb not null,
  explicacion_juegos text,
  notas text,
  total numeric,
  recomendacion text,
  created_at timestamp with time zone default now() not null,
  constraint entrevistas_pkey PRIMARY KEY (id)
);

create table public.familias (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  zona text,
  telefono text,
  ninos text,
  notas text,
  created_at timestamp with time zone default now() not null,
  direccion text,
  cuenta_bancaria text[],
  cobro_hora numeric,
  pago_hora numeric,
  frecuencia_cobro text default 'mensual'::text not null,
  contactada_riesgo_en date,
  constraint familias_pkey PRIMARY KEY (id),
  constraint familias_frecuencia_cobro_check CHECK ((frecuencia_cobro = ANY (ARRAY['diario'::text, 'semanal'::text, 'mensual'::text])))
);

create table public.fechas_marketing (
  id uuid default gen_random_uuid() not null,
  fecha date not null,
  titulo text not null,
  sugerencia text,
  publicado boolean default false,
  notas text,
  created_at timestamp with time zone default now(),
  constraint fechas_marketing_pkey PRIMARY KEY (id)
);

create table public.gastos_fijos (
  id uuid default gen_random_uuid() not null,
  concepto text not null,
  monto numeric default 0 not null,
  desde date default CURRENT_DATE not null,
  activo boolean default true not null,
  notas text,
  created_at timestamp with time zone default now() not null,
  constraint gastos_fijos_pkey PRIMARY KEY (id)
);

create table public.gastos_generales (
  id uuid default gen_random_uuid() not null,
  fecha date not null,
  concepto text not null,
  monto numeric default 0 not null,
  notas text,
  created_at timestamp with time zone default now(),
  constraint gastos_generales_pkey PRIMARY KEY (id)
);

create table public.hijos_familia (
  id uuid default gen_random_uuid() not null,
  familia_id uuid not null,
  nombre text,
  fecha_nacimiento date,
  colegio text,
  orden integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  edad_declarada integer,
  edad_declarada_en date,
  constraint hijos_familia_pkey PRIMARY KEY (id)
);

create table public.incidentes (
  id uuid default gen_random_uuid() not null,
  fecha date default CURRENT_DATE not null,
  tipo text default 'otro'::text not null,
  gravedad text default 'leve'::text not null,
  ninera_id uuid,
  ninera_nombre text,
  familia_id uuid,
  familia_nombre text,
  sitting_id uuid,
  descripcion text not null,
  registrado_por text,
  created_at timestamp with time zone default now() not null,
  constraint incidentes_pkey PRIMARY KEY (id),
  constraint incidentes_gravedad_check CHECK ((gravedad = ANY (ARRAY['leve'::text, 'moderado'::text, 'grave'::text]))),
  constraint incidentes_tipo_check CHECK ((tipo = ANY (ARRAY['accidente'::text, 'queja'::text, 'otro'::text])))
);

create table public.intermediaciones_enrique (
  id uuid default gen_random_uuid() not null,
  ninera_id uuid,
  ninera_nombre text not null,
  fecha date not null,
  monto numeric default 0 not null,
  comentarios text,
  registrado_por text,
  created_at timestamp with time zone default now() not null,
  cobrado boolean default false not null,
  constraint intermediaciones_enrique_pkey PRIMARY KEY (id)
);

create table public.intermediaciones_enrique_pool (
  id uuid default gen_random_uuid() not null,
  ninera_id uuid not null,
  ninera_nombre text not null,
  estado text default 'activa'::text not null,
  updated_at timestamp with time zone default now() not null,
  constraint intermediaciones_enrique_pool_ninera_id_key UNIQUE (ninera_id),
  constraint intermediaciones_enrique_pool_pkey PRIMARY KEY (id),
  constraint intermediaciones_enrique_pool_estado_check CHECK ((estado = ANY (ARRAY['activa'::text, 'disponible'::text])))
);

create table public.intermediaciones_eventos (
  id uuid default gen_random_uuid() not null,
  empresa text not null,
  fecha date not null,
  cobro_total numeric default 0 not null,
  comentarios text,
  registrado_por text,
  created_at timestamp with time zone default now() not null,
  cobrado boolean default false not null,
  constraint intermediaciones_eventos_pkey PRIMARY KEY (id)
);

create table public.intermediaciones_eventos_ninieras (
  id uuid default gen_random_uuid() not null,
  evento_id uuid not null,
  ninera_id uuid,
  ninera_nombre text not null,
  hora_inicio time without time zone,
  hora_fin time without time zone,
  pago numeric default 0 not null,
  pagado boolean default false not null,
  constraint intermediaciones_eventos_ninieras_pkey PRIMARY KEY (id)
);

create table public.juguetes (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  tipo text,
  genero text default 'unisex'::text not null,
  edad_desde integer,
  edad_hasta integer,
  foto_url text,
  ninera_id uuid,
  ninera_nombre text,
  estado text default 'disponible'::text not null,
  notas text,
  created_at timestamp with time zone default now() not null,
  constraint juguetes_pkey PRIMARY KEY (id),
  constraint juguetes_estado_check CHECK ((estado = ANY (ARRAY['disponible'::text, 'perdido'::text, 'roto'::text]))),
  constraint juguetes_genero_check CHECK ((genero = ANY (ARRAY['unisex'::text, 'ninas'::text, 'ninos'::text])))
);

create table public.juguetes_movimientos (
  id uuid default gen_random_uuid() not null,
  juguete_id uuid not null,
  ninera_anterior text,
  ninera_nueva text,
  fecha timestamp with time zone default now() not null,
  notas text,
  constraint juguetes_movimientos_pkey PRIMARY KEY (id)
);

create table public.ninieras (
  id uuid default gen_random_uuid() not null,
  candidata_id uuid,
  nombre text not null,
  telefono text,
  zona text,
  tipo text default 'Niñera'::text,
  foto text,
  cv_url text,
  notas text,
  activa boolean default true not null,
  created_at timestamp with time zone default now() not null,
  cuenta_bancaria text[],
  carsitting_mail_enviado_at timestamp with time zone,
  cv_generado_en date,
  temporada jsonb,
  temporada_actualizada_en timestamp with time zone,
  temporada_propuesta jsonb,
  temporada_propuesta_en timestamp with time zone,
  temporada_token uuid default gen_random_uuid() not null,
  temporada_fuente text,
  temporada_comentario text,
  barrios text,
  telefono_pendiente text,
  telefono_pendiente_en timestamp with time zone,
  constraint ninieras_pkey PRIMARY KEY (id)
);

create table public.notif_push_enviadas (
  notif_id text not null,
  enviado_en timestamp with time zone default now() not null,
  constraint notif_push_enviadas_pkey PRIMARY KEY (notif_id)
);

create table public.notif_push_preferencias (
  usuario text not null,
  tipo text not null,
  activado boolean not null,
  constraint notif_push_preferencias_pkey PRIMARY KEY (usuario, tipo)
);

create table public.notificaciones_leidas (
  notif_id text not null,
  usuario text not null,
  leido_en timestamp with time zone default now() not null,
  constraint notificaciones_leidas_pkey PRIMARY KEY (notif_id, usuario)
);

create table public.push_subscriptions (
  id uuid default gen_random_uuid() not null,
  usuario text not null,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  creado_en timestamp with time zone default now() not null,
  constraint push_subscriptions_endpoint_key UNIQUE (endpoint),
  constraint push_subscriptions_pkey PRIMARY KEY (id)
);

create table public.resenas_ninieras (
  id uuid default gen_random_uuid() not null,
  ninera_nombre text not null,
  ninera_id uuid,
  presentacion text,
  puntualidad text,
  trato_ninos text,
  conformidad text,
  puntuacion integer,
  fecha date,
  origen text default 'Form (auto)'::text,
  created_at timestamp with time zone default now(),
  constraint resenas_ninieras_pkey PRIMARY KEY (id)
);

-- Respaldo previo a la migración del 05/10/2026 (misma forma que asignaciones antes de
-- agregar vigencia y tipo). Sin políticas: no lo ve la app.
create table public.respaldo_asignaciones_20261005 (
  id uuid,
  familia_id uuid,
  ninera_id uuid,
  ninera_nombre text,
  cobro_hora numeric,
  pago_hora numeric,
  created_at timestamp with time zone,
  dias jsonb,
  hora_inicio time without time zone,
  hora_fin time without time zone
);

-- Respaldos manuales de la reorganización de zonas del 30/09/2026 (sin políticas: no
-- los ve la app). Se pueden borrar cuando ya no hagan falta.
create table public.respaldo_zona_grupos_20260930 (
  id uuid,
  nombre text,
  zonas text[],
  orden integer,
  created_at timestamp with time zone,
  fuera_de_montevideo boolean
);

create table public.respaldo_zonas_20260930 (
  tabla text,
  id uuid,
  zona text,
  zona_sitting text
);

create table public.sittings_traslados (
  id uuid default gen_random_uuid() not null,
  tipo text not null,
  registrado_por text,
  familia_id uuid,
  familia_nombre text not null,
  ninera_id uuid,
  ninera_nombre text not null,
  fecha date not null,
  hora_inicio time without time zone,
  hora_fin time without time zone,
  km numeric,
  origen text,
  destino text,
  cobro_familia numeric default 0,
  pago_ninera numeric default 0,
  notas text,
  created_at timestamp with time zone default now(),
  termina_dia_siguiente boolean default false not null,
  cobrado boolean default false not null,
  pagado boolean default false not null,
  fuente text default 'app'::text not null,
  asignacion_id uuid,
  cancelado boolean default false not null,
  constraint sittings_traslados_pkey PRIMARY KEY (id),
  constraint sittings_traslados_fuente_check CHECK ((fuente = ANY (ARRAY['app'::text, 'historico'::text]))),
  constraint sittings_traslados_tipo_check CHECK ((tipo = ANY (ARRAY['sitting'::text, 'traslado'::text])))
);

-- Historial de cambios de sittings_traslados (lo escribe el trigger sittings_historial_trg).
create table public.sittings_historial (
  id bigint generated always as identity primary key,
  sitting_id uuid not null,
  accion text not null,
  usuario text,
  cuando timestamp with time zone default now() not null,
  cambios jsonb,
  fila jsonb,
  constraint sittings_historial_accion_check CHECK ((accion = ANY (ARRAY['alta'::text, 'cambio'::text, 'baja'::text])))
);

create table public.solicitud_ninieras (
  id uuid default gen_random_uuid() not null,
  solicitud_id uuid not null,
  ninera_id uuid,
  ninera_nombre text not null,
  pago_ninera numeric,
  estado text default 'invitada'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint solicitud_ninieras_pkey PRIMARY KEY (id),
  constraint solicitud_ninieras_estado_check CHECK ((estado = ANY (ARRAY['invitada'::text, 'confirmada'::text, 'rechazada'::text])))
);

create table public.solicitudes (
  id uuid default gen_random_uuid() not null,
  familia_id uuid,
  familia_nombre text not null,
  tipo text not null,
  zona text,
  fecha date not null,
  hora_inicio time without time zone not null,
  hora_fin time without time zone,
  cobro_familia numeric,
  estado text default 'sin_asignar'::text not null,
  notas text,
  created_at timestamp with time zone default now() not null,
  termina_dia_siguiente boolean default false not null,
  constraint solicitudes_pkey PRIMARY KEY (id),
  constraint solicitudes_estado_check CHECK ((estado = ANY (ARRAY['sin_asignar'::text, 'pendiente_confirmar'::text, 'confirmada'::text, 'cancelada'::text]))),
  constraint solicitudes_tipo_check CHECK ((tipo = ANY (ARRAY['sitting'::text, 'traslado'::text])))
);

create table public.tarifas_traslado_config (
  id uuid default gen_random_uuid() not null,
  tarifa_base numeric default 0 not null,
  precio_km numeric default 0 not null,
  rec1_desde time without time zone,
  rec1_hasta time without time zone,
  rec1_mult numeric default 1 not null,
  rec2_desde time without time zone,
  rec2_hasta time without time zone,
  rec2_mult numeric default 1 not null,
  margen_premium numeric default 1 not null,
  updated_at timestamp with time zone default now() not null,
  margen_ninera numeric default 0.15,
  constraint tarifas_traslado_config_pkey PRIMARY KEY (id)
);

-- Eventos crudos del webhook de WhatsApp (sin políticas: solo Edge Functions).
create table public.whatsapp_eventos_raw (
  id uuid default gen_random_uuid() not null,
  payload jsonb not null,
  procesado boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint whatsapp_eventos_raw_pkey PRIMARY KEY (id)
);

create table public.zona_grupos (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  zonas text[] default '{}'::text[] not null,
  orden integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  fuera_de_montevideo boolean default false not null,
  constraint zona_grupos_pkey PRIMARY KEY (id)
);

create table public.zonas_confirmadas (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  created_at timestamp with time zone default now() not null,
  constraint zonas_confirmadas_nombre_key UNIQUE (nombre),
  constraint zonas_confirmadas_pkey PRIMARY KEY (id)
);

-- ----------------------------------------------------------------------------
-- Claves foráneas
-- ----------------------------------------------------------------------------

alter table public.asignaciones add constraint asignaciones_familia_id_fkey FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE CASCADE;
alter table public.asignaciones add constraint asignaciones_ninera_id_fkey FOREIGN KEY (ninera_id) REFERENCES ninieras(id) ON DELETE SET NULL;
alter table public.carsitting_datos add constraint carsitting_datos_ninera_id_fkey FOREIGN KEY (ninera_id) REFERENCES ninieras(id) ON DELETE SET NULL;
alter table public.entrevistas add constraint entrevistas_candidata_id_fkey FOREIGN KEY (candidata_id) REFERENCES candidatas(id) ON DELETE CASCADE;
alter table public.hijos_familia add constraint hijos_familia_familia_id_fkey FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE CASCADE;
alter table public.incidentes add constraint incidentes_familia_id_fkey FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE SET NULL;
alter table public.incidentes add constraint incidentes_ninera_id_fkey FOREIGN KEY (ninera_id) REFERENCES ninieras(id) ON DELETE SET NULL;
alter table public.incidentes add constraint incidentes_sitting_id_fkey FOREIGN KEY (sitting_id) REFERENCES sittings_traslados(id) ON DELETE SET NULL;
alter table public.intermediaciones_enrique add constraint intermediaciones_enrique_ninera_id_fkey FOREIGN KEY (ninera_id) REFERENCES ninieras(id);
alter table public.intermediaciones_enrique_pool add constraint intermediaciones_enrique_pool_ninera_id_fkey FOREIGN KEY (ninera_id) REFERENCES ninieras(id);
alter table public.intermediaciones_eventos_ninieras add constraint intermediaciones_eventos_ninieras_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES intermediaciones_eventos(id) ON DELETE CASCADE;
alter table public.intermediaciones_eventos_ninieras add constraint intermediaciones_eventos_ninieras_ninera_id_fkey FOREIGN KEY (ninera_id) REFERENCES ninieras(id);
alter table public.juguetes add constraint juguetes_ninera_id_fkey FOREIGN KEY (ninera_id) REFERENCES ninieras(id) ON DELETE SET NULL;
alter table public.juguetes_movimientos add constraint juguetes_movimientos_juguete_id_fkey FOREIGN KEY (juguete_id) REFERENCES juguetes(id) ON DELETE CASCADE;
alter table public.ninieras add constraint ninieras_candidata_id_fkey FOREIGN KEY (candidata_id) REFERENCES candidatas(id) ON DELETE SET NULL;
alter table public.resenas_ninieras add constraint resenas_ninieras_ninera_id_fkey FOREIGN KEY (ninera_id) REFERENCES ninieras(id) ON DELETE SET NULL;
alter table public.sittings_traslados add constraint sittings_traslados_asignacion_id_fkey FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id) ON DELETE SET NULL;
alter table public.sittings_traslados add constraint sittings_traslados_familia_id_fkey FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE SET NULL;
alter table public.sittings_traslados add constraint sittings_traslados_ninera_id_fkey FOREIGN KEY (ninera_id) REFERENCES ninieras(id) ON DELETE SET NULL;
alter table public.solicitud_ninieras add constraint solicitud_ninieras_ninera_id_fkey FOREIGN KEY (ninera_id) REFERENCES ninieras(id) ON DELETE SET NULL;
alter table public.solicitud_ninieras add constraint solicitud_ninieras_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE;
alter table public.solicitudes add constraint solicitudes_familia_id_fkey FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- Índices (además de los de las claves primarias y únicas)
-- ----------------------------------------------------------------------------

CREATE INDEX asignaciones_familia_id_idx ON public.asignaciones USING btree (familia_id);
CREATE INDEX asignaciones_ninera_id_idx ON public.asignaciones USING btree (ninera_id);
CREATE INDEX idx_asignaciones_vigencia ON public.asignaciones USING btree (familia_id, vigente_desde, vigente_hasta);
CREATE INDEX idx_candidatas_estado ON public.candidatas USING btree (estado);
CREATE INDEX idx_carsitting_ninera_id ON public.carsitting_datos USING btree (ninera_id);
CREATE INDEX idx_contratos_parte ON public.contratos USING btree (parte_nombre);
CREATE INDEX entrevistas_candidata_id_idx ON public.entrevistas USING btree (candidata_id);
CREATE INDEX idx_fechas_marketing_fecha ON public.fechas_marketing USING btree (fecha);
CREATE INDEX idx_gastos_fecha ON public.gastos_generales USING btree (fecha);
CREATE INDEX idx_hijos_familia_familia_id ON public.hijos_familia USING btree (familia_id);
CREATE INDEX idx_ninieras_activa ON public.ninieras USING btree (activa);
CREATE INDEX ninieras_candidata_id_idx ON public.ninieras USING btree (candidata_id);
CREATE UNIQUE INDEX ninieras_temporada_token_key ON public.ninieras USING btree (temporada_token);
CREATE INDEX idx_resenas_ninera_id ON public.resenas_ninieras USING btree (ninera_id);
CREATE INDEX idx_resenas_ninera_nombre ON public.resenas_ninieras USING btree (ninera_nombre);
CREATE INDEX idx_sittings_asignacion_fecha ON public.sittings_traslados USING btree (asignacion_id, fecha) WHERE (asignacion_id IS NOT NULL);
CREATE INDEX idx_sittings_familia_id ON public.sittings_traslados USING btree (familia_id);
CREATE INDEX idx_sittings_familia_nombre ON public.sittings_traslados USING btree (familia_nombre);
CREATE INDEX idx_sittings_fecha ON public.sittings_traslados USING btree (fecha);
CREATE INDEX idx_sittings_ninera_id ON public.sittings_traslados USING btree (ninera_id);
CREATE INDEX idx_sittings_ninera_nombre ON public.sittings_traslados USING btree (ninera_nombre);
CREATE INDEX idx_sittings_pendiente_cobro ON public.sittings_traslados USING btree (familia_id) WHERE (cobrado = false);
CREATE INDEX idx_sittings_pendiente_pago ON public.sittings_traslados USING btree (ninera_id) WHERE (pagado = false);
CREATE INDEX idx_sittings_historial_sitting ON public.sittings_historial USING btree (sitting_id, cuando DESC);
CREATE INDEX idx_solicitud_ninieras_ninera_id ON public.solicitud_ninieras USING btree (ninera_id);
CREATE INDEX idx_solicitud_ninieras_solicitud_id ON public.solicitud_ninieras USING btree (solicitud_id);
CREATE INDEX idx_solicitudes_familia_id ON public.solicitudes USING btree (familia_id);
CREATE INDEX idx_solicitudes_fecha ON public.solicitudes USING btree (fecha);

-- ----------------------------------------------------------------------------
-- Row Level Security: todas las tablas con RLS. Las que no tienen política
-- (app_secrets, respaldo_*, whatsapp_eventos_raw) solo son accesibles con la
-- service role (Edge Functions). sittings_historial: solo lectura para la app.
-- ----------------------------------------------------------------------------

alter table public.app_config enable row level security;
alter table public.app_secrets enable row level security;
alter table public.asignaciones enable row level security;
alter table public.candidatas enable row level security;
alter table public.carsitting_datos enable row level security;
alter table public.contratos enable row level security;
alter table public.entrevista_preguntas enable row level security;
alter table public.entrevistas enable row level security;
alter table public.familias enable row level security;
alter table public.fechas_marketing enable row level security;
alter table public.gastos_fijos enable row level security;
alter table public.gastos_generales enable row level security;
alter table public.hijos_familia enable row level security;
alter table public.incidentes enable row level security;
alter table public.intermediaciones_enrique enable row level security;
alter table public.intermediaciones_enrique_pool enable row level security;
alter table public.intermediaciones_eventos enable row level security;
alter table public.intermediaciones_eventos_ninieras enable row level security;
alter table public.juguetes enable row level security;
alter table public.juguetes_movimientos enable row level security;
alter table public.ninieras enable row level security;
alter table public.notif_push_enviadas enable row level security;
alter table public.notif_push_preferencias enable row level security;
alter table public.notificaciones_leidas enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.resenas_ninieras enable row level security;
alter table public.respaldo_asignaciones_20261005 enable row level security;
alter table public.respaldo_zona_grupos_20260930 enable row level security;
alter table public.respaldo_zonas_20260930 enable row level security;
alter table public.sittings_historial enable row level security;
alter table public.sittings_traslados enable row level security;
alter table public.solicitud_ninieras enable row level security;
alter table public.solicitudes enable row level security;
alter table public.tarifas_traslado_config enable row level security;
alter table public.whatsapp_eventos_raw enable row level security;
alter table public.zona_grupos enable row level security;
alter table public.zonas_confirmadas enable row level security;

create policy app_config_authenticated_all on public.app_config as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy solo_autenticados_todo on public.asignaciones as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy solo_autenticados_todo on public.candidatas as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy authenticated_all_carsitting_datos on public.carsitting_datos as permissive for all to authenticated
  using (true)
  with check (true);
create policy contratos_authenticated_all on public.contratos as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy "authenticated all" on public.entrevista_preguntas as permissive for all to authenticated
  using (true)
  with check (true);
create policy solo_autenticados_todo on public.entrevistas as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy solo_autenticados_todo on public.familias as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy fechas_marketing_authenticated_all on public.fechas_marketing as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy gastos_fijos_authenticated_all on public.gastos_fijos as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy gastos_generales_authenticated_all on public.gastos_generales as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy "authenticated all" on public.hijos_familia as permissive for all to authenticated
  using (true)
  with check (true);
create policy authenticated_all on public.incidentes as permissive for all to authenticated
  using (true)
  with check (true);
create policy authenticated_all on public.intermediaciones_enrique as permissive for all to authenticated
  using (true)
  with check (true);
create policy authenticated_all on public.intermediaciones_enrique_pool as permissive for all to authenticated
  using (true)
  with check (true);
create policy authenticated_all on public.intermediaciones_eventos as permissive for all to authenticated
  using (true)
  with check (true);
create policy authenticated_all on public.intermediaciones_eventos_ninieras as permissive for all to authenticated
  using (true)
  with check (true);
create policy solo_autenticados_todo on public.juguetes as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy solo_autenticados_todo on public.juguetes_movimientos as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy solo_autenticados_todo on public.ninieras as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy notif_push_enviadas_authenticated_all on public.notif_push_enviadas as permissive for all to authenticated
  using (true)
  with check (true);
create policy notif_push_preferencias_authenticated_all on public.notif_push_preferencias as permissive for all to authenticated
  using (true)
  with check (true);
create policy notificaciones_leidas_authenticated_all on public.notificaciones_leidas as permissive for all to authenticated
  using (true)
  with check (true);
create policy push_subscriptions_authenticated_all on public.push_subscriptions as permissive for all to authenticated
  using (true)
  with check (true);
create policy resenas_ninieras_authenticated_all on public.resenas_ninieras as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy sittings_historial_leer on public.sittings_historial as permissive for select to authenticated
  using (true);
create policy sittings_traslados_authenticated_all on public.sittings_traslados as permissive for all to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy solicitud_ninieras_authenticated_all on public.solicitud_ninieras as permissive for all to authenticated
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy solicitudes_authenticated_all on public.solicitudes as permissive for all to authenticated
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy tarifas_traslado_config_authenticated_all on public.tarifas_traslado_config as permissive for all to authenticated
  using ((( SELECT auth.role() AS role) = 'authenticated'::text))
  with check ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy "authenticated all" on public.zona_grupos as permissive for all to authenticated
  using (true)
  with check (true);
create policy "authenticated all" on public.zonas_confirmadas as permissive for all to authenticated
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- Storage: 3 buckets públicos de lectura
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values
  ('candidatas-fotos', 'candidatas-fotos', true),
  ('juguetes-fotos', 'juguetes-fotos', true),
  ('ninieras-fotos', 'ninieras-fotos', true)
on conflict (id) do nothing;

-- candidatas-fotos no tiene políticas desde el 05/10/2026: solo sube la Edge Function
-- candidatas-webhook (clave de servicio) y las fotos se ven por URL pública. Antes había
-- dos políticas que dejaban subir y listar sin login.
create policy juguetes_fotos_authenticated_delete on storage.objects as permissive for delete to public
  using (((bucket_id = 'juguetes-fotos'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));
create policy juguetes_fotos_authenticated_update on storage.objects as permissive for update to public
  using (((bucket_id = 'juguetes-fotos'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));
create policy juguetes_fotos_authenticated_write on storage.objects as permissive for insert to public
  with check (((bucket_id = 'juguetes-fotos'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));
create policy juguetes_fotos_public_read on storage.objects as permissive for select to public
  using ((bucket_id = 'juguetes-fotos'::text));
create policy ninieras_fotos_authenticated_delete on storage.objects as permissive for delete to public
  using (((bucket_id = 'ninieras-fotos'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));
create policy ninieras_fotos_authenticated_update on storage.objects as permissive for update to public
  using (((bucket_id = 'ninieras-fotos'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));
create policy ninieras_fotos_authenticated_write on storage.objects as permissive for insert to public
  with check (((bucket_id = 'ninieras-fotos'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));
create policy ninieras_fotos_public_read on storage.objects as permissive for select to public
  using ((bucket_id = 'ninieras-fotos'::text));

-- ----------------------------------------------------------------------------
-- Funciones y tareas programadas (pg_cron)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reprogramar_fechas_marketing_vencidas()
 RETURNS TABLE(id uuid, titulo text, fecha_anterior date, fecha_nueva date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  nueva_fecha date;
begin
  for r in
    select f.id, f.titulo, f.fecha, f.notas
    from public.fechas_marketing f
    where f.fecha < current_date
  loop
    nueva_fecha := r.fecha;
    while nueva_fecha < current_date loop
      nueva_fecha := (nueva_fecha + interval '1 year')::date;
    end loop;

    update public.fechas_marketing
    set fecha = nueva_fecha,
        publicado = false,
        notas = case
          when r.notas is null or r.notas = '' then
            'Reprogramada automáticamente el ' || to_char(current_date, 'DD/MM/YYYY') || ' (antes: ' || to_char(r.fecha, 'DD/MM/YYYY') || ').'
          else
            r.notas || ' | Reprogramada automáticamente el ' || to_char(current_date, 'DD/MM/YYYY') || ' (antes: ' || to_char(r.fecha, 'DD/MM/YYYY') || ').'
        end
    where fechas_marketing.id = r.id;

    id := r.id;
    titulo := r.titulo;
    fecha_anterior := r.fecha;
    fecha_nueva := nueva_fecha;
    return next;
  end loop;
  return;
end;
$function$;

revoke execute on function public.reprogramar_fechas_marketing_vencidas() from public, anon, authenticated;
grant execute on function public.reprogramar_fechas_marketing_vencidas() to service_role;

-- Todos los días a las 06:00 UTC (03:00 en Montevideo).
select cron.schedule('reprogramar-fechas-marketing', '0 6 * * *', $$select public.reprogramar_fechas_marketing_vencidas();$$);

-- Cada 10 minutos: dispara la Edge Function de avisos push urgentes. En otro proyecto,
-- cambiar la URL por la de ese proyecto.
select cron.schedule('enviar-push-urgentes', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://wvewzamdohrpfhpccvcz.supabase.co/functions/v1/enviar-push-urgentes',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- Historial de sittings: cada alta, cambio y baja queda registrada con el mail de quien
-- lo hizo (sale del token de la sesión).
CREATE OR REPLACE FUNCTION public.registrar_historial_sitting()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  usr text;
  diff jsonb := '{}'::jsonb;
  k text;
  viejo jsonb;
  nuevo jsonb;
begin
  begin
    usr := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  exception when others then
    usr := null;
  end;
  usr := coalesce(usr, current_user);

  if tg_op = 'INSERT' then
    insert into public.sittings_historial (sitting_id, accion, usuario, fila) values (new.id, 'alta', usr, to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.sittings_historial (sitting_id, accion, usuario, fila) values (old.id, 'baja', usr, to_jsonb(old));
    return old;
  else
    viejo := to_jsonb(old);
    nuevo := to_jsonb(new);
    for k in select jsonb_object_keys(nuevo) loop
      if (viejo -> k) is distinct from (nuevo -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('antes', viejo -> k, 'despues', nuevo -> k));
      end if;
    end loop;
    if diff <> '{}'::jsonb then
      insert into public.sittings_historial (sitting_id, accion, usuario, cambios) values (new.id, 'cambio', usr, diff);
    end if;
    return new;
  end if;
end;
$function$;
revoke execute on function public.registrar_historial_sitting() from public, anon, authenticated;

create trigger sittings_historial_trg
  after insert or update or delete on public.sittings_traslados
  for each row execute function public.registrar_historial_sitting();

-- ----------------------------------------------------------------------------
-- Realtime: tablas publicadas (la app se suscribe por módulo, ver agenda.js)
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table public.app_config;
alter publication supabase_realtime add table public.asignaciones;
alter publication supabase_realtime add table public.candidatas;
alter publication supabase_realtime add table public.carsitting_datos;
alter publication supabase_realtime add table public.contratos;
alter publication supabase_realtime add table public.entrevistas;
alter publication supabase_realtime add table public.familias;
alter publication supabase_realtime add table public.fechas_marketing;
alter publication supabase_realtime add table public.gastos_fijos;
alter publication supabase_realtime add table public.gastos_generales;
alter publication supabase_realtime add table public.incidentes;
alter publication supabase_realtime add table public.intermediaciones_enrique;
alter publication supabase_realtime add table public.intermediaciones_enrique_pool;
alter publication supabase_realtime add table public.intermediaciones_eventos;
alter publication supabase_realtime add table public.intermediaciones_eventos_ninieras;
alter publication supabase_realtime add table public.juguetes;
alter publication supabase_realtime add table public.juguetes_movimientos;
alter publication supabase_realtime add table public.ninieras;
alter publication supabase_realtime add table public.resenas_ninieras;
alter publication supabase_realtime add table public.sittings_traslados;
alter publication supabase_realtime add table public.solicitud_ninieras;
alter publication supabase_realtime add table public.solicitudes;
alter publication supabase_realtime add table public.tarifas_traslado_config;
