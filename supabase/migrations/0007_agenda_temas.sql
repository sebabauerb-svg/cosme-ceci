-- ============================================================
-- Agenda de temas para las novedades (research semanal + ideas de Ceci)
-- El código aplica esto solo, idempotente, vía ensureTemas()
-- en src/lib/db.ts. Este archivo queda como referencia/documentación.
-- ============================================================

create table if not exists agenda_temas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  resumen text,                              -- qué pasó / de qué se habla
  angulo text,                               -- cómo lo contaría Ceci
  tipo text check (tipo in ('novedad','tip','nota')),
  fuentes jsonb not null default '[]'::jsonb, -- [{ "titulo": ..., "url": ... }]
  evidencia text,                            -- solida | emergente | moda (solo research)
  estado text not null default 'idea' check (estado in ('idea','elegido','publicado','descartado')),
  origen text not null default 'ceci' check (origen in ('research','ceci')),
  slug text,                                 -- entrada del blog que salió del tema
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agenda_temas_estado on agenda_temas (estado, created_at desc);
