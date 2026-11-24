-- ============================================================
-- Sesiones de un plan agendadas por la paciente desde Mi cuenta.
-- Solo agrega. El código lo aplica solo vía ensurePlanesAgenda() en
-- src/lib/db.ts; este archivo es referencia.
-- ============================================================

-- El plan está contratado y pago: la paciente puede agendar sus sesiones.
-- Sin habilitado_at no agenda nada (así no quedan turnos sin pagar).
alter table planes add column if not exists habilitado_at  timestamptz;
alter table planes add column if not exists habilitado_por text;  -- 'ceci' | 'compra'
-- Compra online (reserva con producto, PR #26) de la que salió el plan.
alter table planes add column if not exists compra_id      uuid;
create unique index if not exists planes_compra on planes (compra_id) where compra_id is not null;
