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
 * Si una sede queda sin dirección, el mail la nombra igual pero sin dirección:
 * nunca se inventa una.
 */

export const direcciones: Record<string, string> = {
  'San José': 'Treinta y Tres esquina Larrañaga Escritorio Duca & Aldaz',
  Montevideo: 'Maldonado 1321 apto 402',
};

/** Dirección de la sede, o null si no la tenemos cargada. */
export function direccionSede(sede?: string | null): string | null {
  if (!sede) return null;
  return direcciones[sede] || null;
}

/**
 * 'Montevideo Maldonado 1321 apto 402', o solo el nombre si no hay dirección.
 * Sin guión ni coma entre sede y calle: así lo escribe Ceci en sus mensajes.
 */
export function sedeConDireccion(sede?: string | null): string | null {
  if (!sede) return null;
  const dir = direccionSede(sede);
  return dir ? `${sede} ${dir}` : sede;
}
