/**
 * TRATAMIENTOS
 * ============
 * Catálogo clínico del dossier, agrupado por categoría.
 * Decisión de negocio: NO se muestran precios por tratamiento en la web
 * (posicionamiento boutique → "valor según protocolo definido en consulta").
 * Los valores de referencia del anexo de tarifas quedan en comentarios para Ceci.
 */

export type Tratamiento = {
  nombre: string;
  descripcion: string;
  // precioRef: solo referencia interna (NO se renderiza). Ver anexo de tarifas.
  precioRef?: string;
};

export type CategoriaTratamiento = {
  id: string;
  grupo: string;
  titulo: string;
  intro: string;
  tratamientos: Tratamiento[];
};

export const categoriasTratamientos: CategoriaTratamiento[] = [
  {
    id: 'faciales-limpieza',
    grupo: 'Tratamientos Faciales',
    titulo: 'Limpieza y Renovación',
    intro: 'El punto de partida de toda piel saludable: limpiar, renovar y preparar.',
    tratamientos: [
      {
        nombre: 'Higiene Profunda con Extracciones',
        descripcion:
          'Elimina impurezas, exceso de oleosidad y comedones, mejorando la oxigenación y ' +
          'la preparación cutánea.',
        precioRef: '$2.400 / paquete 6: $12.000',
      },
      {
        nombre: 'Microdermoabrasión con Puntas de Diamante',
        descripcion:
          'Renovación suave y controlada de la superficie cutánea. Mejora la textura, ' +
          'luminosidad y apariencia general.',
        precioRef: '$2.000 / paquete 6: $9.900',
      },
      {
        nombre: 'Dermaplaning',
        descripcion:
          'Exfoliación física que elimina células superficiales y vello fino. La piel luce ' +
          'más uniforme, suave y luminosa desde la primera sesión.',
      },
      {
        nombre: 'Peelings Químicos',
        descripcion:
          'Renovación celular adaptada a cada estación del año. Ayuda a mitigar manchas, ' +
          'imperfecciones y signos de envejecimiento.',
        precioRef: '$2.600 / paquete 6: $13.200',
      },
    ],
  },
  {
    id: 'faciales-hidratacion',
    grupo: 'Tratamientos Faciales',
    titulo: 'Hidratación y Revitalización',
    intro: 'Devolver confort, elasticidad y vitalidad a la piel.',
    tratamientos: [
      {
        nombre: 'Hidratación Shock',
        descripcion:
          'Devuelve de forma inmediata el confort, la elasticidad y la luminosidad a pieles ' +
          'deshidratadas o sensibilizadas.',
      },
      {
        nombre: 'Mesoterapia Facial',
        descripcion:
          'Aplicación experta de activos como vitaminas, ácido hialurónico y péptidos para ' +
          'mejorar globalmente la calidad de la piel.',
        precioRef: '$3.200 / paquete 6: $16.200',
      },
      {
        nombre: 'Meso Lips',
        descripcion:
          'Tratamiento exclusivo para mejorar la hidratación y revitalización profunda de los ' +
          'labios, aportando suavidad absoluta.',
      },
    ],
  },
  {
    id: 'tecnologia',
    grupo: 'Tecnología Avanzada',
    titulo: 'Rejuvenecimiento y Tecnología',
    intro: 'Estímulo del colágeno y corrección con tecnología de última generación.',
    tratamientos: [
      {
        nombre: 'Microneedling',
        descripcion:
          'Estimula los mecanismos naturales de reparación cutánea y favorece la producción ' +
          'de colágeno y elastina de forma orgánica.',
        precioRef: '$3.200 / paquete 6: $16.200',
      },
      {
        nombre: 'Radiofrecuencia Facial',
        descripcion:
          'Tecnología no invasiva que estimula nuevas fibras de colágeno, mejorando la firmeza ' +
          'y turgencia de la piel.',
      },
      {
        nombre: 'Luz Pulsada Intensa (IPL)',
        descripcion:
          'Procedimiento médico-estético versátil para trabajar manchas, rojeces difusas y un ' +
          'rejuvenecimiento global del rostro.',
        precioRef: '$2.600 / paquete 6: $13.200',
      },
      {
        nombre: 'Tratamientos Despigmentantes',
        descripcion:
          'Protocolos altamente personalizados para corregir alteraciones pigmentarias y ' +
          'unificar el tono cutáneo.',
        precioRef: '$2.800 / paquete 6: $14.400',
      },
    ],
  },
  {
    id: 'capilar',
    grupo: 'Tratamientos Capilares',
    titulo: 'Salud del Cuero Cabelludo',
    intro: 'Revitalización del folículo y un entorno biológico sano para el cabello.',
    tratamientos: [
      {
        nombre: 'Radiofrecuencia Capilar',
        descripcion:
          'Favorece la microcirculación del cuero cabelludo y mejora el entorno biológico para ' +
          'un crecimiento fuerte y saludable.',
        precioRef: '$2.200 / paquete 6: $11.000',
      },
      {
        nombre: 'Mesoterapia Capilar',
        descripcion:
          'Aplicación localizada de activos para fortalecer y revitalizar el folículo piloso en ' +
          'protocolos de recuperación.',
        precioRef: '$3.200 / paquete 6: $16.200',
      },
    ],
  },
  {
    id: 'corporal',
    grupo: 'Tratamientos Corporales',
    titulo: 'Remodelación y Firmeza',
    intro: 'Cuidado corporal de alta gama, zona por zona.',
    tratamientos: [
      {
        nombre: 'Ultracavitación & Mesoterapia Corporal',
        descripcion:
          'Remodelación, reducción de adiposidad localizada y mejora sustancial de la celulitis ' +
          'y la firmeza corporal.',
        precioRef: '$2.600 (zona) / paquete 6: $13.200',
      },
      {
        nombre: 'Luz Pulsada Intensa (IPL) Corporal',
        descripcion:
          'Depilación progresiva y tratamientos rejuvenecedores adaptados a cada zona y ' +
          'necesidad específica.',
      },
    ],
  },
];
