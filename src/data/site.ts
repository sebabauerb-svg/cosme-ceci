/**
 * CONFIGURACIÓN GENERAL DEL SITIO
 * ================================
 * Cecilia Gutiérrez · Cosmetología Médica (Montevideo y San José, Uruguay).
 * Editá acá los datos de marca, contacto y enlaces. Casi todo el sitio lee de
 * este archivo, así que cambiar algo acá lo actualiza en todas las páginas.
 *
 * ⚠️ Datos de contacto tomados del dossier institucional de Ceci. CONFIRMAR
 *    antes de publicar (marcados "CONFIRMAR").
 */

export const site = {
  // Identidad de marca (paraguas)
  marca: {
    nombre: 'Cecilia Gutiérrez',
    subtitulo: 'Cosmetología Médica',
    iniciales: 'CG',
  },
  tagline: 'Cuidado profesional para una piel sana, equilibrada y luminosa',
  descripcion:
    'Cosmetología Médica con enfoque boutique en Montevideo y San José. Evaluación profesional, ' +
    'tecnología y activos de última generación para una piel sana, equilibrada y luminosa. ' +
    'Cada protocolo se diseña a la medida real de tu piel.',

  // Profesional
  profesional: {
    nombre: 'Cecilia Gutiérrez',
    nombreCorto: 'Ceci',
    titulo: 'Cosmetóloga Médica',
    zonas: 'Montevideo y San José, Uruguay',
  },

  // Contacto y canales (CONFIRMAR todos antes de publicar)
  contacto: {
    // Número en formato internacional, sin espacios ni símbolos (para WhatsApp).
    // Tomado del cel del dossier: 098 19 20 50 → +598 98 192 050
    whatsapp: '59898192050', // CONFIRMAR
    whatsappDisplay: '098 19 20 50', // CONFIRMAR
    email: '', // CONFIRMAR: completar si tiene mail de contacto
    instagram: 'cgcosmetologiamedica',
    instagramUrl: 'https://instagram.com/cgcosmetologiamedica',
  },

  // Enlaces operativos (CONFIRMAR): se enchufan los reales cuando estén listos
  enlaces: {
    pagoMercadoPago: '', // link de pago fijo, opcional
    agenda: '', // agenda online (Calendly, etc.), opcional → si vacío, se coordina por WhatsApp
  },

  // Mensaje que se pre-carga al abrir WhatsApp desde el sitio
  whatsappMensaje:
    'Hola Ceci! Me gustaría coordinar una consulta de valoración. ¿Cómo seguimos?',
};

/** Construye un enlace de WhatsApp con mensaje pre-cargado. */
export function whatsappLink(mensaje: string = site.whatsappMensaje): string {
  return `https://wa.me/${site.contacto.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}
