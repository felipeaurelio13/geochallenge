import { useTranslation } from 'react-i18next';
import { Question } from '../types';
import { parseMovieSceneQuestionData, getMovieSceneBySlug } from '../data/movieScenes';

interface MovieSceneAttributionProps {
  question: Question;
}

export function MovieSceneAttribution({ question }: MovieSceneAttributionProps) {
  const { t } = useTranslation();
  if (question.category !== 'MOVIE_SCENE') return null;

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
