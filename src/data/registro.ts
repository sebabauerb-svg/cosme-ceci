/**
 * Opciones de "Mi registro" (lo que completa la paciente en su perfil).
 * Ceci puede pedir sacar, cambiar o agregar opciones: se editan acá.
 * Objetivos y hábitos son los mismos de la ficha (src/data/ficha.ts), así Ceci
 * compara lo que marca la paciente con lo que carga ella en la anamnesis.
 *
 * Es lo que la paciente siente y usa, con sus palabras: no es un diagnóstico.
 */
export { OBJETIVOS, HABITOS } from './ficha';

/** Cómo siente la piel hoy (puede marcar varias). */
export const SENSACIONES = [
  'Tirante',
  'Seca',
  'Grasa o brillosa',
  'Sensible o me arde',
  'Con brotes',
  'Con manchas',
  'Opaca',
  'La siento bien',
] as const;

/** Nota general de 1 a 5, con palabras para que no sea un número frío. */
export const NOTAS = { 1: 'Muy mal', 2: 'Mal', 3: 'Más o menos', 4: 'Bien', 5: 'Muy bien' } as const;

export const MOMENTOS = ['Mañana', 'Noche', 'Mañana y noche', 'Algunas veces por semana'] as const;

export const PASOS = ['Limpieza', 'Tónico', 'Sérum', 'Contorno de ojos', 'Hidratante', 'Protector solar', 'Exfoliante', 'Máscara', 'Otro'] as const;

/** Tope de productos por registro (alcanza para cualquier rutina real). */
export const MAX_PRODUCTOS = 20;
