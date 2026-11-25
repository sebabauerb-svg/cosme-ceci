/**
 * MODALIDADES DE ATENCIÓN
 * =======================
 * Las cuatro formas de trabajar con Ceci, del dossier institucional.
 * El precio de la Consulta se muestra; el resto se define en consulta
 * (posicionamiento boutique). Editá textos y notas acá.
 */

export type Modalidad = {
  id: string;
  nombre: string;
  subtitulo: string;
  descripcion: string;
  alcance: string;
  precio?: string;
  precioNota?: string;
  destacado?: boolean;
  ctaTexto: string;
};

export const modalidades: Modalidad[] = [
  {
    id: 'presencial',
    nombre: 'Consulta Presencial',
    subtitulo: 'Evaluación clínica y diagnóstico profesional',
    descripcion:
      'La instancia fundamental de diagnóstico en consultorio. A través de una evaluación ' +
      'visual y táctil profunda analizamos la salud de la barrera cutánea, tus antecedentes, ' +
      'biotipo y las condiciones específicas de tu piel.',
    alcance:
      'Confección de historia clínica estética, diagnóstico inicial de autor y diseño ' +
      'estratégico de tu primer protocolo de tratamiento personalizado.',
    precio: '$1.800',
    // Regla confirmada por Ceci (nov-2026): la evaluación es sin costo si ese
    // mismo día hace el tratamiento. "Se bonifica al contratar un protocolo" no
    // se entendía (¿gratis o descuento?, ¿qué es un protocolo?).
    precioNota: 'Sin costo si ese mismo día hacés tu primer tratamiento',
    ctaTexto: 'Reservar consulta',
  },
  {
    id: 'virtual',
    nombre: 'Consulta Virtual',
    subtitulo: 'Cosmetología Médica sin límites',
    descripcion:
      'El rigor de la práctica presencial, adaptado a la flexibilidad digital. Ideal si estás ' +
      'fuera de Montevideo o San José, o si buscás un seguimiento profesional continuo desde ' +
      'tu casa.',
    alcance:
      'Videollamada personalizada de alta resolución, análisis guiado de tus preocupaciones ' +
      'actuales y desarrollo integral de una rutina domiciliaria optimizada.',
    precio: '$1.500',
    precioNota: 'Sesión por videollamada',
    ctaTexto: 'Reservar videollamada',
  },
  {
    id: 'skincare-inteligente',
    nombre: 'Asesoramiento Skincare Inteligente',
    subtitulo: '¿Vemos qué tenés en tu nécessaire?',
    descripcion:
      'Un servicio enfocado en la optimización y el consumo consciente. Muchas veces la ' +
      'respuesta no está en comprar más productos, sino en aprender a usar bien los que ya tenés.',
    alcance:
      'Analizamos los activos, fórmulas y combinaciones de tus productos actuales. Corregimos ' +
      'errores de aplicación, eliminamos pasos redundantes o irritantes y reestructuramos tu ' +
      'rutina maximizando el valor de tu inversión.',
    precio: '$1.600',
    precioNota: 'Sesión única',
    ctaTexto: 'Reservar asesoramiento',
  },
  {
    id: 'club',
    // En /reservar esta opción es el Club REGULAR; la tarjeta de la home muestra
    // los dos planes (override en Modalidades.astro).
    nombre: 'Club de las Estaciones',
    subtitulo: 'Membresía anual · 4 consultas virtuales',
    descripcion:
      'La piel es un órgano vivo que cambia con el clima, las estaciones y el tiempo. Una rutina ' +
      'fija todo el año es una rutina obsoleta. El Club es el acompañamiento continuo de tu piel.',
    alcance:
      'Una consulta en cada cambio de estación para reevaluar tu piel y adaptar tu recetario. ' +
      'Dos planes: Regular, con las 4 consultas virtuales, y Premium, con las 4 presenciales y ' +
      'un registro de seguimiento de tu piel.',
    precio: '$4.800 / año',
    precioNota: 'Por transferencia, el precio publicado. Con Mercado Pago, +10% y la opción de pagar hasta en 3 cuotas',
    destacado: true,
    ctaTexto: 'Ver los dos planes',
  },
  // Solo para /reservar: en la home el Club tiene UNA tarjeta (ver Modalidades.astro).
  {
    id: 'club-premium',
    nombre: 'Club de las Estaciones Premium',
    subtitulo: 'Membresía anual · 4 consultas presenciales',
    descripcion: '',
    alcance: '',
    precio: 'U$S 200 / año',
    precioNota: 'Por transferencia, el precio publicado. Con Mercado Pago, +10% y la opción de pagar hasta en 3 cuotas',
    ctaTexto: 'Sumarme',
  },
];
