/**
 * WHATSAPP AUTOMÁTICO
 * ===================
 * Le escribe a la paciente desde el número de Ceci, sin abrir WhatsApp a mano:
 * al confirmar el turno, al moverlo y el día anterior (recordatorio).
 *
 * Usa la API oficial de WhatsApp (Meta) en modo "coexistencia": el número sigue
 * funcionando en la app WhatsApp Business del celular de Ceci, y lo que manda la
 * web aparece en el mismo chat. Paso a paso para conectarla:
 * INSTRUCCIONES-WHATSAPP-CECI.md.
 *
 * Para escribirle primero a alguien, WhatsApp exige PLANTILLAS aprobadas por
 * Meta: textos fijos con huecos {{1}}, {{2}}… Los nombres y el orden de los
 * huecos de acá tienen que coincidir EXACTO con las plantillas cargadas (ver la
 * guía). Si no coinciden, Meta rechaza el envío y queda en el log.
 *
 * Variables (Vercel):
 *  - WHATSAPP_API_KEY         la clave del proveedor. Sin ella, todo esto está
 *                             apagado y el panel sigue con los botones manuales.
 *  - WHATSAPP_PROVIDER        'ycloud' (default) o 'meta' (API de Meta directa).
 *  - WHATSAPP_FROM            número que envía, con +598 (default: el de site.ts).
 *  - WHATSAPP_PHONE_NUMBER_ID solo con provider 'meta'.
 *  - WHATSAPP_TEMPLATE_LANG   idioma de las plantillas (default 'es').
 *
 * Nunca lanza: un WhatsApp que no sale no puede trabar una confirmación.
 */

import { site } from '../data/site';
import { sedeConDireccion } from '../data/sedes';

export type PlantillaWA = 'confirmado' | 'movido' | 'recordatorio';

/** Nombre de cada plantilla tal como se carga en el proveedor. */
export const NOMBRES_PLANTILLA: Record<PlantillaWA, string> = {
  confirmado: 'turno_confirmado',
  movido: 'turno_movido',
  recordatorio: 'turno_recordatorio',
};

/** Las que llevan el botón "Cambiar horario" (link a /mi-turno?c=<código>). */
const CON_BOTON: PlantillaWA[] = ['confirmado', 'movido'];

export type DatosTurnoWA = {
  nombre: string;
  /** 'Consulta Presencial', 'Consulta Virtual', … */
  servicio: string;
  /** 'jueves 8 de octubre' */
  fechaLarga: string | null;
  hora: string | null;
  /** nombre de la sede en la base, o null si es online */
  sede: string | null;
  /** código de autogestión (va en el botón "Cambiar horario") */
  token?: string | null;
  /** solo recordatorio: línea de cobro ya armada */
  cobro?: string | null;
};

export type ResultadoWA = { ok: boolean; error?: string };

function config() {
  const apiKey = process.env.WHATSAPP_API_KEY;
  if (!apiKey) return null;
  const provider = process.env.WHATSAPP_PROVIDER === 'meta' ? 'meta' : 'ycloud';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  if (provider === 'meta' && !phoneNumberId) return null;
  return {
    provider,
    apiKey,
    phoneNumberId,
    from: process.env.WHATSAPP_FROM || `+${site.contacto.whatsapp}`,
    lang: process.env.WHATSAPP_TEMPLATE_LANG || 'es',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v23.0',
  } as const;
}

/** ¿Está prendido el envío automático? */
export function whatsappConfigurado(): boolean {
  return !!config();
}

/**
 * Teléfono como lo cargó la paciente → formato internacional (+598…).
 * Acepta '098 123 456', '98123456', '+598 98 123 456' y números de otros
 * países si vienen con + o 00 adelante. null si no parece un número.
 */
export function telefonoE164(tel: string | null | undefined): string | null {
  const raw = String(tel ?? '').trim();
  const digitos = raw.replace(/\D/g, '');
  if (!digitos) return null;
  if (raw.startsWith('+') || raw.startsWith('00')) {
    const d = raw.startsWith('00') ? digitos.slice(2) : digitos;
    return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
  }
  if (digitos.startsWith('598') && digitos.length === 11) return `+${digitos}`;
  const local = digitos.replace(/^0/, '');
  return local.length === 8 ? `+598${local}` : null;
}

/** 'jueves 8 de octubre' → 'Jueves 8 de octubre' */
const capitalizar = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Meta rechaza variables vacías o con saltos de línea, tabs o 4+ espacios
 * seguidos. Se limpian acá para que un dato raro no tire el envío entero.
 */
const limpiar = (s: unknown) =>
  String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim() || '—';

/** Los huecos de cada plantilla, en orden. Ver la guía para el texto completo. */
export function parametrosPlantilla(p: PlantillaWA, d: DatosTurnoWA): string[] {
  const base = [
    d.nombre,
    d.servicio,
    d.fechaLarga ? capitalizar(d.fechaLarga) : '',
    d.hora ?? '',
    d.sede ? sedeConDireccion(d.sede) : 'Videollamada (te enviamos el link antes de la consulta)',
  ];
  return (p === 'recordatorio' ? [...base, d.cobro ?? ''] : base).map(limpiar);
}

/**
 * Línea de cobro del recordatorio: lo que queda por pagar en la consulta.
 * Misma lógica que el mensaje manual (src/lib/mensajes.ts).
 */
export function lineaCobro(senaPagada: number | null, saldo: number | null): string {
  const $ = (n: number) => '$' + n.toLocaleString('es-UY');
  const seno = senaPagada != null && senaPagada > 0;
  if (saldo == null) return seno ? `Seña recibida: ${$(senaPagada!)}. El saldo lo abonás en la consulta.` : 'El pago lo abonás en la consulta.';
  if (saldo === 0) return 'Tu consulta ya está abonada.';
  if (seno) return `Seña recibida: ${$(senaPagada!)}. Saldo a abonar en la consulta: ${$(saldo)}.`;
  return `A abonar en la consulta: ${$(saldo)}.`;
}

/** Envía una plantilla de turno a la paciente. Nunca lanza. */
export async function enviarWhatsApp(
  plantilla: PlantillaWA,
  telefono: string | null | undefined,
  d: DatosTurnoWA
): Promise<ResultadoWA> {
  const cfg = config();
  if (!cfg) return { ok: false, error: 'WhatsApp automático no configurado' };
  const to = telefonoE164(telefono);
  if (!to) return { ok: false, error: 'Teléfono inválido' };

  const components: any[] = [
    {
      type: 'body',
      parameters: parametrosPlantilla(plantilla, d).map((text) => ({ type: 'text', text })),
    },
  ];
  if (CON_BOTON.includes(plantilla) && d.token) {
    // Botón "Cambiar horario": la URL base está en la plantilla y acá va solo
    // la parte variable (el código de la reserva).
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: d.token }] });
  }
  const template = { name: NOMBRES_PLANTILLA[plantilla], language: { code: cfg.lang }, components };

  try {
    const res =
      cfg.provider === 'meta'
        ? await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: to.slice(1), type: 'template', template }),
            signal: AbortSignal.timeout(10_000),
          })
        : await fetch('https://api.ycloud.com/v2/whatsapp/messages/sendDirectly', {
            method: 'POST',
            headers: { 'X-API-Key': cfg.apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({ from: cfg.from, to, type: 'template', template }),
            signal: AbortSignal.timeout(10_000),
          });
    if (!res.ok) {
      const msg = `WhatsApp ${plantilla} ${res.status}: ${(await res.text()).slice(0, 500)}`;
      console.error(msg);
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e) {
    const msg = `WhatsApp ${plantilla}: ${e instanceof Error ? e.message : String(e)}`;
    console.error(msg);
    return { ok: false, error: msg };
  }
}
