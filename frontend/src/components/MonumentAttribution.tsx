import { useTranslation } from 'react-i18next';
import { Question } from '../types';
import { getMonumentByEnName, parseMonumentQuestionData, getMonumentBySlug } from '../data/monuments';

interface MonumentAttributionProps {
  question: Question;
}

/**
 * Renderiza la atribución de imagen para preguntas MONUMENT, después de responder.
 * Devuelve null para cualquier otra categoría o si no se encuentra el monumento.
 */
export function MonumentAttribution({ question }: MonumentAttributionProps) {
  const { t } = useTranslation();
  if (question.category !== 'MONUMENT') return null;

  const variantPayload = parseMonumentQuestionData(question.questionData);
  const monument = variantPayload
    ? getMonumentBySlug(variantPayload.slug)
    : getMonumentByEnName(question.correctAnswer);

  if (!monument) return null;
  const { author, license, sourceUrl } = monument.attribution;

  return (
    <span>
      {t('game.monumentAttribution', { author, license })}
      {sourceUrl && (
        <>
          {' · '}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-200"
          >
            {t('game.monumentAttributionSource', 'Wikimedia Commons')}
          </a>
        </>
      )}
    </span>
  );
}
