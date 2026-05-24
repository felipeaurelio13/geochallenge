import { useTranslation } from 'react-i18next';
import { Question } from '../types';
import { parseMovieSceneQuestionData, getMovieSceneBySlug, parseCinemaGeoQuestionData } from '../data/movieScenes';

interface MovieSceneAttributionProps {
  question: Question;
}

export function MovieSceneAttribution({ question }: MovieSceneAttributionProps) {
  const { t } = useTranslation();
  if (question.category !== 'MOVIE_SCENE') return null;

  // New Cinema & Geography format: show nothing (needs_sources has no public attribution yet;
  // when approved with real sourceUrl, this component can be extended).
  const cgPayload = parseCinemaGeoQuestionData(question.questionData);
  if (cgPayload) return null;

  // Legacy format: show Wikimedia Commons attribution
  const payload = parseMovieSceneQuestionData(question.questionData);
  if (!payload) return null;

  const scene = getMovieSceneBySlug(payload.slug);
  if (!scene) return null;

  const { author, license, sourceUrl } = scene.attribution;

  return (
    <span>
      {t('game.movieSceneAttribution', { author, license })}
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
