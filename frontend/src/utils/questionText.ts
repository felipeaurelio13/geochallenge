import type { TFunction } from 'i18next';
import type { Question } from '../types';
import { parseMonumentQuestionData } from '../data/monuments';

/**
 * Genera el texto de la pregunta TRADUCIDO al idioma activo del cliente.
 *
 * Antes esta lógica vivía duplicada en QuestionCard.tsx y DailyChallengePage.tsx,
 * y ambas caían a `question.questionText` que el backend generaba en español
 * fijo. Resultado: en Daily y Cinema-Geo el texto aparecía en español dentro
 * de UIs en inglés (QA round 2, bug ROUND2-001 / CRITICAL).
 *
 * Ahora la fuente de verdad es i18next + el JSON embebido en questionData
 * (bilingüe para CINEMA_GEO). El `questionText` del backend queda como
 * último fallback para no romper preguntas sin metadata.
 */
export function getLocalizedQuestionText(
  question: Question,
  t: TFunction,
  _lang: string
): string {
  const dataValue = getQuestionDataPlainValue(question);

  switch (question.category) {
    case 'FLAG':
      return t('game.questionFlag', '¿A qué país pertenece esta bandera?');
    case 'CAPITAL':
      return t('game.questionCapital', { country: dataValue, defaultValue: `¿Cuál es la capital de ${dataValue}?` });
    case 'MAP':
      return t('game.questionMap', { capital: dataValue, defaultValue: `¿Dónde está ${dataValue}?` });
    case 'SILHOUETTE':
      return t('game.questionSilhouette', '¿Qué país representa esta silueta?');
    case 'MONUMENT': {
      const variant = parseMonumentQuestionData(question.questionData)?.variant ?? 'identify';
      return variant === 'country'
        ? t('game.questionMonumentCountry', '¿En qué país está este monumento?')
        : t('game.questionMonumentIdentify', '¿Qué monumento es este?');
    }
    default:
      if (question.questionText?.trim()) return question.questionText;
      return dataValue || '';
  }
}

function getQuestionDataPlainValue(question: Question): string {
  if (!question.questionData) return '';
  if (typeof question.questionData === 'string') {
    const trimmed = question.questionData.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as { country?: string; capital?: string };
        return parsed.country || parsed.capital || '';
      } catch {
        // ignore
      }
    }
    return question.questionData;
  }
  return question.questionData.country || question.questionData.capital || '';
}

