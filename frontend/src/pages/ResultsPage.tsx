import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGame } from '../context/GameContext';
import { api } from '../services/api';
import { LoadingSpinner } from '../components';
import { AnswerStatusBadge } from '../components/AnswerStatusBadge';

export function ResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, resetGame } = useGame();

  const { score, questions, results } = state;
  const correctAnswers = results.filter((r) => r.isCorrect).length;

  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareStatus, setShareStatus] = useState<'idle' | 'success'>('idle');
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    const fetchRank = async () => {
      try {
        const rankData = await api.getMyRank();
        setUserRank(rankData.userRank?.rank || null);
      } catch (err) {
        console.error('Failed to fetch rank:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRank();
  }, []);

  const totalQuestions = questions.length || 10;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);
  const incorrectAnswers = totalQuestions - correctAnswers;

  const shareText = useMemo(
    () =>
      t('results.shareText', {
        score,
        correct: correctAnswers,
        total: totalQuestions,
        accuracy: `${percentage}%`,
      }),
    [t, score, correctAnswers, totalQuestions, percentage]
  );

  const getPerformanceEmoji = () => {
    if (percentage >= 90) return '🏆';
    if (percentage >= 70) return '🎉';
    if (percentage >= 50) return '👍';
    if (percentage >= 30) return '🤔';
    return '💪';
  };

  const getPerformanceMessage = () => {
    if (percentage >= 90) return t('results.excellent');
    if (percentage >= 70) return t('results.great');
    if (percentage >= 50) return t('results.good');
    if (percentage >= 30) return t('results.keepPracticing');
    return t('results.tryAgain');
  };

  const handlePlayAgain = () => {
    resetGame();
    navigate('/menu');
  };

  const handleShareResults = async () => {
    const sharePayload = {
      title: t('app.name'),
      text: shareText,
    };

    try {
      setIsSharing(true);
      if (navigator.share) {
        await navigator.share(sharePayload);
      } else {
        await navigator.clipboard.writeText(shareText);
      }

      setShareStatus('success');
      window.setTimeout(() => setShareStatus('idle'), 2500);
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Failed to share score:', error);
      }
    } finally {
      setIsSharing(false);
    }
  };

  if (questions.length === 0 && !loading) {
    navigate('/menu');
    return null;
  }

  return (
    <div className="h-full min-h-0 bg-gray-900 px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6 sm:py-8">
      <main className="mx-auto w-full max-w-xl" aria-label="results-summary">
        <section className="rounded-3xl border border-gray-700 bg-gray-800/95 p-5 text-center shadow-2xl shadow-black/30 sm:p-8">
          <div className="text-6xl sm:text-7xl mb-3" aria-hidden="true">{getPerformanceEmoji()}</div>

          <h1 className="text-3xl font-bold text-white sm:text-4xl">{t('results.gameOver')}</h1>
          <p className="mt-2 text-lg text-gray-300 sm:text-xl">{getPerformanceMessage()}</p>

          <div className="mt-6 rounded-2xl border border-primary/35 bg-gray-900/90 p-5">
            <p className="text-sm font-medium uppercase tracking-wide text-primary/80">{t('game.score')}</p>
            <div className="mt-1 text-5xl font-black text-white sm:text-6xl">{score.toLocaleString()}</div>
            <div className="mt-1 text-gray-400">{t('results.points')}</div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-700 bg-gray-900/75 p-4 text-left">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
              <span>{t('results.accuracy')}</span>
              <span className="font-semibold text-white">{percentage}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-700/80 p-0.5" data-testid="results-accuracy-bar">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-400 via-emerald-400 to-primary transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
            <article className="min-w-0 rounded-xl border border-gray-700 bg-gray-900/95 p-3 sm:p-4">
              <div className="text-2xl font-bold text-green-400">{correctAnswers}</div>
              <div className="mt-2 flex justify-center min-w-0">
                <AnswerStatusBadge
                  status="correct"
                  label={t('results.correct')}
                  className="w-full justify-center text-[11px] sm:text-xs"
                />
              </div>
            </article>
            <article className="min-w-0 rounded-xl border border-gray-700 bg-gray-900/95 p-3 sm:p-4">
              <div className="text-2xl font-bold text-red-400">{incorrectAnswers}</div>
              <div className="mt-2 flex justify-center min-w-0">
                <AnswerStatusBadge
                  status="incorrect"
                  label={t('results.incorrect')}
                  className="w-full justify-center text-[11px] sm:text-xs"
                />
              </div>
            </article>
            <article className="min-w-0 rounded-xl border border-gray-700 bg-gray-900/95 p-3 sm:p-4">
              <div className="text-2xl font-bold text-white">{percentage}%</div>
              <div className="text-xs text-gray-400">{t('results.accuracy')}</div>
            </article>
          </div>

          {loading ? (
            <div className="mt-6">
              <LoadingSpinner size="sm" />
            </div>
          ) : userRank ? (
            <div className="mt-6 rounded-xl border border-yellow-700 bg-gradient-to-r from-yellow-900/50 to-orange-900/50 p-4">
              <div className="text-sm text-yellow-300">{t('results.yourRank')}</div>
              <div className="text-3xl font-bold text-yellow-400">#{userRank}</div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900/70 p-4 text-sm text-gray-300">
              {t('rankings.empty')}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-gray-700 bg-gray-800/80 p-4 sm:p-5">
          <p className="text-sm text-gray-300">{t('results.shareScore')}</p>
          <button
            onClick={handleShareResults}
            disabled={isSharing}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            🔗 {isSharing ? `${t('common.loading')}...` : t('results.shareButton')}
          </button>
          <p className="mt-2 min-h-5 text-xs text-green-300" aria-live="polite">
            {shareStatus === 'success' ? t('results.copied') : ''}
          </p>
        </section>

        <section
          className="sticky bottom-0 z-10 mt-5 rounded-2xl border border-gray-700 bg-gray-800/95 p-3 backdrop-blur-sm"
          data-testid="results-action-tray"
        >
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handlePlayAgain}
              className="w-full min-h-12 rounded-xl bg-primary px-4 py-3 text-base font-bold text-white shadow-md shadow-primary/25 transition-colors hover:bg-primary/85"
            >
              {t('results.playAgain')}
            </button>
            <Link
              to="/rankings"
              className="inline-flex w-full min-h-12 items-center justify-center rounded-xl bg-gray-700 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-gray-600"
            >
              {t('results.viewRankings')}
            </Link>
            <Link to="/menu" className="py-2 text-center text-gray-300 transition-colors hover:text-white">
              {t('common.backToMenu')}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
