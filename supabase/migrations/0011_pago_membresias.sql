-- ============================================================
-- Cobro online del Club y de los paquetes de tratamientos (nov-2026)
-- El código aplica esto solo, idempotente, vía ensureCompras() en
-- src/lib/db.ts. Este archivo queda como referencia/documentación.
-- Solo AGREGA columnas: no borra ni cambia nada de lo existente.
--
-- Una compra (Club Regular, Club Premium o un paquete) es una fila de
-- `reservas` sin fecha ni hora, con `producto` cargado. La seña de las
-- consultas NO usa estas columnas: sigue validándose contra precio_uyu.
-- ============================================================

-- Qué se compró: 'club' | 'club-premium' | 'paquete6:<tratamiento>' | 'paquete12:<tratamiento>'
alter table reservas add column if not exists producto text;
-- Nombre legible al momento de comprar (no cambia si después cambia el catálogo)
alter table reservas add column if not exists producto_nombre text;
-- Moneda del cobro: 'UYU' | 'USD' (el Club Premium está en dólares)
alter table reservas add column if not exists moneda text;
-- Precio de lista al momento de comprar
alter table reservas add column if not exists precio_lista numeric(10,2);
-- Lo que se espera cobrar por el medio elegido (transferencia = lista − 10%).
-- El webhook de Mercado Pago valida monto Y moneda contra esto.
alter table reservas add column if not exists monto_esperado numeric(10,2);
-- Medio elegido al comprar: 'mercadopago' | 'transferencia'
alter table reservas add column if not exists via_pago text;
-- Lo que informó Mercado Pago del pago aprobado
alter table reservas add column if not exists mp_cuotas integer;
alter table reservas add column if not exists mp_moneda text;
alter table reservas add column if not exists mp_monto numeric(10,2);
-- Cuándo quedó pagada la compra (MP aprobado o Ceci confirmó la transferencia)
alter table reservas add column if not exists pagado_at timestamptz;

create index if not exists reservas_producto on reservas (producto) where producto is not null;

-- Seña por tratamiento, editable en /admin → Precios. NULL = la seña general
-- ($700, SENA_UYU). Solo se cobra con SENA_POR_TRATAMIENTO_ACTIVA prendida.
-- (La aplica ensurePrecios() en src/lib/db.ts.)
alter table precios add column if not exists sena integer check (sena is null or sena between 0 and 1000000);
