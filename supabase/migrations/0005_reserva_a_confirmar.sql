-- ============================================================
-- Fase 2 — Reserva SIN pago (a confirmar por Ceci)
-- El código aplica esto solo, idempotente, vía ensureConfirmacion()
-- en src/lib/db.ts. Este archivo queda como referencia/documentación.
-- ============================================================

-- Nuevo estado: reserva web pendiente de que Ceci la valide (hold 2 h).
alter type reserva_estado add value if not exists 'a_confirmar';

-- Seguimiento del cobro (lo registra Ceci a mano; una reserva confirmada
-- puede quedar con pagado=false para seguimiento del giro/efectivo).
alter table reservas add column if not exists monto_cobrado numeric(10,2);
alter table reservas add column if not exists pagado boolean;

-- El cupo único ahora bloquea también las reservas 'a_confirmar'.
-- Se crea con nombre nuevo y se dropea el viejo (para no recrear en cada request).
create unique index if not exists reservas_slot_unico_v2
  on reservas (coalesce(sede_id::text, 'online'), fecha, hora)
  where estado in ('pendiente_pago','confirmada','a_confirmar') and fecha is not null;

drop index if exists reservas_slot_unico;
