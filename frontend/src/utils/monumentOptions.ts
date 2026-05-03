import { Question } from '../types';
import { getMonumentByEnName, parseMonumentQuestionData, resolveLanguage } from '../data/monuments';

/**
 * Devuelve la etiqueta a mostrar para una opción.
 * - Para MONUMENT variante 'identify' traduce nombre EN canónico al idioma activo.
 * - Para todas las demás categorías y variantes, devuelve el valor crudo.
 * El valor crudo (en EN canónico) se sigue usando para el click handler y la
 * comparación contra correctAnswer, así no se cambia el contrato del backend.
 */
export function getOptionDisplayLabel(question: Question, option: string, lang: string | undefined): string {
  if (question.category !== 'MONUMENT') return option;
  const variant = parseMonumentQuestionData(question.questionData)?.variant;
  if (variant !== 'identify') return option;

  const monument = getMonumentByEnName(option);
  if (!monument) return option;
  const resolved = resolveLanguage(lang);
  return monument.name[resolved] ?? option;
}
