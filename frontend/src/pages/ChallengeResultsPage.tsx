import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../components/atoms/StatCard';
import { Button } from '../components/atoms/Button';

interface ChallengeResultsState {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
}

export function ChallengeResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation();

  const resultState = state as ChallengeResultsState | null;

  if (!resultState || !id) {
    return (
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-800 p-5 text-center sm:p-6">
          <p className="text-sm text-gray-300">{t('challenges.resultsUnavailable')}</p>
          <Button
            onClick={() => navigate('/challenges')}
            variant="primary"
            fullWidth
            className="mt-4"
          >
            {t('challenges.backToList')}
          </Button>
        </div>
      </div>
    );
  }

  const { score, correctAnswers, totalQuestions } = resultState;
  const incorrectAnswers = Math.max(totalQuestions - correctAnswers, 0);
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  return (
    <div className="h-full min-h-0 bg-gray-900 px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="rounded-2xl border border-gray-700 bg-gray-800 p-5 text-center sm:p-6">
          <p className="text-xs uppercase tracking-wide text-primary">{t('challenges.challengeMode')}</p>
          <h1 className="mt-2 text-2xl font-bold">{t('results.gameOver')}</h1>
          <p className="mt-2 text-sm text-gray-300">{t('challenges.resultsSubtitle')}</p>
        </header>

        <section className="rounded-2xl border border-gray-700 bg-gray-800 p-5 sm:p-6">
          <p className="text-sm text-gray-400">{t('challenges.yourScore')}</p>
          <p className="mt-1 text-4xl font-bold text-primary">{score.toLocaleString()}</p>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs sm:gap-3 sm:text-sm">
            <StatCard value={correctAnswers} label={t('results.correct')} color="green" />
            <StatCard value={incorrectAnswers} label={t('results.incorrect')} color="red" />
            <StatCard value={`${accuracy}%`} label={t('results.accuracy')} color="primary" />
          </div>
        </section>

        <div className="space-y-2">
          <Button
            onClick={() => navigate(`/challenges/${id}/play`)}
            variant="ghost"
            fullWidth
            className="border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
          >
            {t('challenges.playAgain')}
          </Button>
          <Button
            onClick={() => navigate('/challenges')}
            variant="primary"
            fullWidth
          >
            {t('challenges.backToList')}
          </Button>
        </div>
      </div>
    </div>
  );
}
