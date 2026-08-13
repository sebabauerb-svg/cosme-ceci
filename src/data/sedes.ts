/**
 * DIRECCIONES DE LAS SEDES
 * ========================
 * Dónde se atiende presencialmente. Van en el mail de confirmación y en el
 * evento de Google Calendar: el mensaje que Ceci manda a mano incluye el lugar,
 * así que el automático tiene que incluirlo también.
 *
 * La clave es el nombre de la sede tal como está en la tabla `sedes` de la base
 * ('Montevideo', 'San José'), que es lo que viaja hasta los emails.
 *
 * ⚠️ FALTA la dirección de Montevideo. Mientras esté vacía, el mail nombra la
 *    sede sin dirección (no inventa nada).
 */

export const direcciones: Record<string, string> = {
  'San José': 'Treinta y Tres esquina Larrañaga (Escritorio Duca & Aldaz)',
  Montevideo: '',
};

/** Dirección de la sede, o null si no la tenemos cargada. */
export function direccionSede(sede?: string | null): string | null {
  if (!sede) return null;
  return direcciones[sede] || null;
}

/** 'San José — Treinta y Tres esquina…', o solo el nombre si no hay dirección. */
export function sedeConDireccion(sede?: string | null): string | null {
  if (!sede) return null;
  const dir = direccionSede(sede);
  return dir ? `${sede} — ${dir}` : sede;
}
