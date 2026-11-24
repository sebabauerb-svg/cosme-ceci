/**
 * CLUB DE LAS ESTACIONES — dos planes
 * ===================================
 * Definido por Ceci (nov-2026):
 * - **Regular:** las 4 consultas son VIRTUALES. Mantiene el valor de siempre ($4.800/año).
 *   Se le sacó la línea "consulta presencial con beneficio de socia": confundía, porque
 *   la presencial NO está incluida.
 * - **Premium:** las 4 consultas son PRESENCIALES, más el registro de seguimiento (cómo
 *   siente la piel, productos actuales, nuevas recomendaciones) que Ceci recuerda
 *   completar y revisa en una consulta online. En DÓLARES a propósito: U$S 200/año.
 * - Pago de ambos: único, con 10% de descuento por transferencia, o hasta 3 cuotas por
 *   Mercado Pago (src/data/pago.ts → formasDePago).
 * - `modalidadId` es la modalidad de /reservar (src/data/modalidades.ts): no cambiarla,
 *   se guarda en la base.
 */

export type PlanClub = {
  modalidadId: 'club' | 'club-premium';
  nombre: string;
  /** Lo que distingue a un plan del otro, en una línea. */
  formato: string;
  precio: string;
  incluye: string[];
  destacado?: boolean;
};

/** Modalidades que son membresía anual (sin fecha, sin seña). */
export const MEMBRESIAS: readonly string[] = ['club', 'club-premium'];
export const esMembresia = (modalidad: string) => MEMBRESIAS.includes(modalidad);

export const club = {
  nombre: 'El Club de las Estaciones',
  subtitulo: 'Membresía anual de cuidado evolutivo',
  intro:
    'La piel es un órgano vivo que cambia con el clima, las estaciones y el tiempo. Una rutina ' +
    'fija todo el año es una rutina obsoleta. El Club es el acompañamiento continuo de tu piel.',

  estaciones: [
    { nombre: 'Otoño', texto: 'Recuperar la piel después del verano y reparar la barrera.' },
    { nombre: 'Invierno', texto: 'Nutrir e hidratar frente al frío y la calefacción.' },
    { nombre: 'Primavera', texto: 'Renovar y preparar la piel para más exposición solar.' },
    { nombre: 'Verano', texto: 'Proteger, aligerar texturas y reforzar el cuidado solar.' },
  ],

  planes: [
    {
      modalidadId: 'club',
      nombre: 'Club Regular',
      formato: 'Consultas virtuales',
      precio: '$4.800',
      incluye: [
        '4 consultas virtuales al año, una en cada cambio de estación',
        'Adaptación de tu recetario domiciliario en cada estación',
        'Prioridad de agenda y acompañamiento entre consultas',
      ],
    },
    {
      modalidadId: 'club-premium',
      nombre: 'Club Premium',
      formato: 'Consultas presenciales',
      precio: 'U$S 200',
      destacado: true,
      incluye: [
        '4 consultas presenciales al año, una en cada cambio de estación',
        'Tu registro de seguimiento: cómo sentís tu piel, tus productos actuales y las nuevas recomendaciones',
        'Una consulta online para revisar tu registro en conjunto, y ayuda para completarlo cuando lo necesites',
        'Adaptación de tu recetario domiciliario en cada estación',
      ],
    },
  ] satisfies PlanClub[],

  precioPeriodo: 'por año',
  cta: 'Sumarme',
};
