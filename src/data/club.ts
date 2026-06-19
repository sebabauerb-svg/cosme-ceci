/**
 * CLUB DE LAS ESTACIONES — plan detallado
 * =======================================
 * Plan "Opción B (híbrido)" del documento de estrategia.
 * ⚠️ Precios provisorios, CONFIRMAR con Ceci.
 */

export const club = {
  nombre: 'El Club de las Estaciones',
  subtitulo: 'Membresía anual de cuidado evolutivo',
  intro:
    'La piel es un órgano vivo que cambia con el clima, las estaciones y el tiempo. Una rutina ' +
    'fija todo el año es una rutina obsoleta. El Club es el acompañamiento continuo de tu piel.',

  precio: '$4.800',
  precioPeriodo: 'por año',
  cuotas: '4 pagos de $1.200, uno por estación',

  estaciones: [
    { nombre: 'Otoño', texto: 'Recuperar la piel después del verano y reparar la barrera.' },
    { nombre: 'Invierno', texto: 'Nutrir e hidratar frente al frío y la calefacción.' },
    { nombre: 'Primavera', texto: 'Renovar y preparar la piel para más exposición solar.' },
    { nombre: 'Verano', texto: 'Proteger, aligerar texturas y reforzar el cuidado solar.' },
  ],

  incluye: [
    'Una consulta diagnóstica online en cada cambio de estación (4 al año)',
    'Adaptación de tu recetario domiciliario en cada estación',
    'Prioridad de agenda y acompañamiento entre consultas',
    'Tu consulta presencial con beneficio de socia, y bonificada al renovar',
  ],

  // Aclaración del modelo híbrido (cuida la agenda de Ceci)
  nota:
    'El valor de la membresía se abona en cuotas estacionales, así sentís el beneficio cada vez ' +
    'que tu piel se reevalúa. La consulta presencial entra con un beneficio especial de socia y ' +
    'queda bonificada cuando renovás tu membresía.',

  cta: 'Sumarme al Club',
};
