/**
 * CLUB DE LAS ESTACIONES PREMIUM — plan detallado
 * ===============================================
 * Definido por Ceci (nov-2026). Reemplaza al Club viejo ($4.800 en 4 cuotas), que
 * se sacó porque no quedaba claro si incluía la consulta (no la incluía).
 *
 * - Valor en DÓLARES, a propósito (decisión de Ceci): U$S 200 por año.
 * - 4 consultas presenciales al año, una por estación.
 * - Registro de seguimiento: la paciente anota cómo siente su piel, sus productos
 *   actuales y las nuevas recomendaciones; Ceci le recuerda completarlo, la ayuda
 *   si lo necesita y lo revisa con ella en una consulta online.
 * - Pago: único, con 10% de descuento por transferencia, o hasta 3 cuotas por
 *   Mercado Pago (ver src/data/pago.ts → formasDePago).
 * - El `id` de la modalidad sigue siendo 'club' (lo usan /reservar y la base).
 */
export const club = {
  nombre: 'Club de las Estaciones Premium',
  subtitulo: 'Membresía anual de cuidado evolutivo',
  intro:
    'La piel es un órgano vivo que cambia con el clima, las estaciones y el tiempo. Una rutina ' +
    'fija todo el año es una rutina obsoleta. El Club es el acompañamiento continuo de tu piel.',

  precio: 'U$S 200',
  precioPeriodo: 'por año',

  estaciones: [
    { nombre: 'Otoño', texto: 'Recuperar la piel después del verano y reparar la barrera.' },
    { nombre: 'Invierno', texto: 'Nutrir e hidratar frente al frío y la calefacción.' },
    { nombre: 'Primavera', texto: 'Renovar y preparar la piel para más exposición solar.' },
    { nombre: 'Verano', texto: 'Proteger, aligerar texturas y reforzar el cuidado solar.' },
  ],

  incluye: [
    '4 consultas presenciales al año, una en cada cambio de estación',
    'Tu registro de seguimiento: cómo sentís tu piel, tus productos actuales y las nuevas recomendaciones',
    'Una consulta online para revisar juntas tu registro, y ayuda para completarlo cuando lo necesites',
    'Adaptación de tu recetario domiciliario en cada estación',
  ],

  nota:
    'Vos vas completando tu registro y yo te recuerdo hacerlo: así vemos, estación a estación, ' +
    'cómo evoluciona tu piel.',

  cta: 'Sumarme al Club',
};
