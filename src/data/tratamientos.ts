/**
 * TRATAMIENTOS — catálogo con valores
 * ===================================
 * Catálogo clínico del dossier, agrupado por categoría, con su valor por sesión.
 * Decisión de negocio (oct-2026, pedido de Ceci): los tratamientos MUESTRAN precio en la
 * web, por transparencia y para que la reserva sea más directa. Reemplaza la regla anterior
 * ("solo la Consulta tiene precio; tratamientos según protocolo").
 *
 * Los precios VIGENTES los carga Ceci desde el panel (/admin → Precios) y viven en la
 * base (tabla `precios`, ver src/lib/precios-vigentes.ts). Los valores de este archivo
 * son los INICIALES y el RESPALDO: se usan para todo tratamiento que Ceci no tocó en el
 * panel, y para todos si la base no responde.
 *
 * Fuente: anexo de tarifas v4 (anexo_tarifas_cecilia_gutierrez_v4.pdf). Lo que no estaba
 * en el anexo va como CONFIRMAR: en la web se ve "Valor en consulta" y, en
 * `npm run dev`, una etiqueta CONFIRMAR para que salte a la vista.
 */

export const CONFIRMAR = 'CONFIRMAR' as const;
/** Valor en pesos uruguayos, o CONFIRMAR si Ceci todavía no lo pasó. */
export type Precio = number | typeof CONFIRMAR;

export type Tratamiento = {
  /** Clave fija (no cambiarla): con ella se guarda el precio editado desde el panel. */
  id: string;
  nombre: string;
  descripcion: string;
  /** Valor de una sesión. */
  precio: Precio;
  /** Cómo se cobra el valor de sesión, si no es "por sesión" (ej. "por zona"). */
  unidad?: string;
  /** Valor del paquete de 6 sesiones, si existe. */
  paquete6?: Precio;
  /** Duración aproximada de la sesión (ej. "60 min"). Opcional: se muestra si está. */
  duracion?: string;
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
        id: 'higiene-profunda',
        nombre: 'Higiene Profunda con Extracciones',
        descripcion:
          'Elimina impurezas, exceso de oleosidad y comedones, mejorando la oxigenación y ' +
          'la preparación cutánea.',
        precio: 2400,
        paquete6: 12000,
      },
      {
        id: 'microdermoabrasion',
        nombre: 'Microdermoabrasión con Puntas de Diamante',
        descripcion:
          'Renovación suave y controlada de la superficie cutánea. Mejora la textura, ' +
          'luminosidad y apariencia general.',
        precio: 2000,
        paquete6: 9900,
      },
      {
        id: 'dermaplaning',
        nombre: 'Dermaplaning',
        descripcion:
          'Exfoliación física que elimina células superficiales y vello fino. La piel luce ' +
          'más uniforme, suave y luminosa desde la primera sesión.',
        precio: CONFIRMAR,
        paquete6: CONFIRMAR,
      },
      {
        id: 'peelings',
        nombre: 'Peelings Químicos',
        descripcion:
          'Renovación celular adaptada a cada estación del año. Ayuda a mitigar manchas, ' +
          'imperfecciones y signos de envejecimiento.',
        precio: 2600,
        paquete6: 13200,
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
        id: 'hidratacion-shock',
        nombre: 'Hidratación Shock',
        descripcion:
          'Devuelve de forma inmediata el confort, la elasticidad y la luminosidad a pieles ' +
          'deshidratadas o sensibilizadas.',
        precio: CONFIRMAR,
        paquete6: CONFIRMAR,
      },
      {
        id: 'mesoterapia-facial',
        nombre: 'Mesoterapia Facial',
        descripcion:
          'Aplicación experta de activos como vitaminas, ácido hialurónico y péptidos para ' +
          'mejorar globalmente la calidad de la piel.',
        precio: 3200,
        paquete6: 16200,
      },
      {
        id: 'meso-lips',
        nombre: 'Meso Lips',
        descripcion:
          'Tratamiento exclusivo para mejorar la hidratación y revitalización profunda de los ' +
          'labios, aportando suavidad absoluta.',
        precio: CONFIRMAR,
        paquete6: CONFIRMAR,
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
        id: 'microneedling',
        nombre: 'Microneedling',
        descripcion:
          'Estimula los mecanismos naturales de reparación cutánea y favorece la producción ' +
          'de colágeno y elastina de forma orgánica.',
        precio: 3200,
        paquete6: 16200,
      },
      {
        id: 'radiofrecuencia-facial',
        nombre: 'Radiofrecuencia Facial',
        descripcion:
          'Tecnología no invasiva que estimula nuevas fibras de colágeno, mejorando la firmeza ' +
          'y turgencia de la piel.',
        precio: CONFIRMAR,
        paquete6: CONFIRMAR,
      },
      {
        id: 'ipl-facial',
        nombre: 'Luz Pulsada Intensa (IPL)',
        descripcion:
          'Procedimiento médico-estético versátil para trabajar manchas, rojeces difusas y un ' +
          'rejuvenecimiento global del rostro.',
        precio: 2600,
        paquete6: 13200,
      },
      {
        id: 'despigmentantes',
        nombre: 'Tratamientos Despigmentantes',
        descripcion:
          'Protocolos altamente personalizados para corregir alteraciones pigmentarias y ' +
          'unificar el tono cutáneo.',
        precio: 2800,
        paquete6: 14400,
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
        id: 'radiofrecuencia-capilar',
        nombre: 'Radiofrecuencia Capilar',
        descripcion:
          'Favorece la microcirculación del cuero cabelludo y mejora el entorno biológico para ' +
          'un crecimiento fuerte y saludable.',
        precio: 2200,
        paquete6: 11000,
      },
      {
        id: 'mesoterapia-capilar',
        nombre: 'Mesoterapia Capilar',
        descripcion:
          'Aplicación localizada de activos para fortalecer y revitalizar el folículo piloso en ' +
          'protocolos de recuperación.',
        precio: 3200,
        paquete6: 16200,
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
        id: 'ultracavitacion',
        nombre: 'Ultracavitación & Mesoterapia Corporal',
        descripcion:
          'Remodelación corporal: ayuda a reducir la adiposidad localizada y a mejorar el aspecto ' +
          'de la celulitis y la firmeza.',
        precio: 2600,
        unidad: 'por zona',
        paquete6: 13200,
      },
      {
        id: 'ipl-corporal',
        nombre: 'Luz Pulsada Intensa (IPL) Corporal',
        descripcion:
          'Depilación progresiva y tratamientos rejuvenecedores adaptados a cada zona y ' +
          'necesidad específica.',
        precio: CONFIRMAR,
        paquete6: CONFIRMAR,
      },
    ],
  },
];

/** "$2.400" — formato de pesos uruguayos con punto de miles. */
export function formatUYU(n: number): string {
  return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

