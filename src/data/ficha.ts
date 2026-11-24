/**
 * Opciones de la ficha de seguimiento (pestaña Pacientes del panel).
 * Ceci puede pedir sacar, cambiar o agregar opciones: se editan acá.
 * Ojo: cambiar el TEXTO de una opción que ya se usó deja las fichas viejas con
 * el texto anterior (se siguen viendo, pero no aparecen marcadas en la lista).
 *
 * Es registro de cosmetología: los antecedentes son lo que la paciente declara
 * y sirven como precaución antes de cada técnica. No es un diagnóstico.
 */

/** Antecedentes y precauciones. Los marcados se muestran arriba, en "Tener en cuenta". */
export const ANTECEDENTES = [
  'Embarazo o lactancia',
  'Herpes recurrente',
  'Isotretinoína (últimos 6 meses)',
  'Anticoagulantes',
  'Marcapasos o implantes metálicos',
  'Epilepsia o fotosensibilidad',
  'Diabetes',
  'Cicatrización queloide',
] as const;

export const FOTOTIPOS = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;

export const TIPOS_PIEL = ['Normal', 'Seca', 'Grasa', 'Mixta'] as const;

export const CONDICIONES = [
  'Sensible',
  'Deshidratada',
  'Manchas',
  'Acné',
  'Rojeces',
  'Líneas de expresión',
  'Flacidez',
] as const;

export const HABITOS = ['Fuma', 'Mucho sol', 'Protector solar diario', 'Duerme poco'] as const;

export const OBJETIVOS = [
  'Tono más parejo',
  'Hidratación',
  'Textura',
  'Control de brotes',
  'Firmeza',
  'Rutina en casa',
] as const;

export const TOLERANCIAS = ['Sin reacción', 'Enrojecimiento leve', 'Enrojecimiento marcado', 'Otra'] as const;

export const ETIQUETAS_FOTO = ['Antes', 'Durante', 'Después', 'Control'] as const;

export const ESTADOS_PLAN = { en_curso: 'En curso', pausado: 'Pausado', terminado: 'Terminado' } as const;
