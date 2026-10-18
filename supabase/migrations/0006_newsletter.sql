-- ============================================================
-- Newsletter de novedades (doble opt-in + envíos por lotes)
-- El código aplica esto solo, idempotente, vía ensureNewsletter()
-- en src/lib/db.ts. Este archivo queda como referencia/documentación.
-- ============================================================

-- Quién pidió recibir las novedades. 'pendiente' hasta que confirma desde el
-- mail; 'baja' si se dio de baja (se conserva como registro de la baja).
create table if not exists newsletter_suscriptores (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,                 -- siempre en minúsculas
  estado text not null default 'pendiente' check (estado in ('pendiente','confirmado','baja')),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),  -- link de confirmar / baja
  origen text,                                -- 'blog' | 'home' | 'reserva'
  consentimiento_at timestamptz not null default now(),  -- cuándo marcó la casilla
  confirmacion_enviada_at timestamptz,
  confirmado_at timestamptz,
  baja_at timestamptz,
  created_at timestamptz not null default now()
);

-- Cada newsletter que arma Ceci desde /admin.
create table if not exists newsletter_envios (
  id uuid primary key default gen_random_uuid(),
  asunto text not null,
  intro text,
  entradas text[] not null,                   -- slugs de src/content/blog
  total integer not null default 0,
  enviados integer not null default 0,
  created_at timestamptz not null default now(),
  terminado_at timestamptz
);

-- A quién ya le salió cada envío (para repartirlo en días sin duplicar).
create table if not exists newsletter_entregas (
  envio_id uuid not null references newsletter_envios(id) on delete cascade,
  suscriptor_id uuid not null references newsletter_suscriptores(id) on delete cascade,
  enviado_at timestamptz not null default now(),
  primary key (envio_id, suscriptor_id)
);
create index if not exists newsletter_entregas_fecha on newsletter_entregas (enviado_at);
