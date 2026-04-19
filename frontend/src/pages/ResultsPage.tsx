import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGame } from '../context/GameContext';
import { api } from '../services/api';
import { LoadingSpinner, ShareButton } from '../components';
import { AnswerStatusBadge } from '../components/AnswerStatusBadge';
import { Button } from '../components/atoms/Button';

export function ResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, resetGame } = useGame();

  const { score, questions, results } = state;
  const correctAnswers = results.filter((r) => r.isCorrect).length;

  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

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
  const pointsBySource = useMemo(
    () => ({
      basePoints: results.reduce((acc, result) => acc + (result.basePoints ?? 0), 0),
      timeBonus: results.reduce((acc, result) => acc + (result.timeBonus ?? 0), 0),
      comboBonus: results.reduce((acc, result) => acc + (result.comboBonus ?? 0), 0),
      accuracyBonus: results.reduce((acc, result) => acc + (result.accuracyBonus ?? 0), 0),
    }),
    [results]
  );
  const pointsBreakdown = [
    { key: 'basePoints', label: t('results.basePoints'), value: pointsBySource.basePoints },
    { key: 'timeBonus', label: t('results.timeBonus'), value: pointsBySource.timeBonus },
    { key: 'comboBonus', label: t('results.comboBonus'), value: pointsBySource.comboBonus },
    { key: 'accuracyBonus', label: t('results.accuracyBonus'), value: pointsBySource.accuracyBonus },
  ].filter((item) => item.value > 0);
  const topPointsSource = pointsBreakdown.reduce<{ key: string; label: string; value: number } | null>(
    (currentTop, item) => {
      if (!currentTop || item.value > currentTop.value) {
        return item;
      }
      return currentTop;
    },
    null
  );

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

  if (questions.length === 0 && !loading) {
    navigate('/menu');
    return null;
  }

  return (
    <div className="h-full min-h-0 bg-gray-900 px-4 py-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6 sm:py-8">
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
                  className="w-full justify-center text-2xs-token sm:text-xs"
                />
              </div>
            </article>
            <article className="min-w-0 rounded-xl border border-gray-700 bg-gray-900/95 p-3 sm:p-4">
              <div className="text-2xl font-bold text-red-400">{incorrectAnswers}</div>
              <div className="mt-2 flex justify-center min-w-0">
                <AnswerStatusBadge
                  status="incorrect"
                  label={t('results.incorrect')}
                  className="w-full justify-center text-2xs-token sm:text-xs"
                />
              </div>
            </article>
            <article className="min-w-0 rounded-xl border border-gray-700 bg-gray-900/95 p-3 sm:p-4">
              <div className="text-2xl font-bold text-white">{percentage}%</div>
              <div className="text-xs text-gray-400">{t('results.accuracy')}</div>
            </article>
          </div>

          {pointsBreakdown.length > 0 && (
            <div className="mt-6 rounded-2xl border border-gray-700 bg-gray-900/75 p-4 text-left">
              <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
                <span>{t('results.pointsBreakdownTitle')}</span>
                {topPointsSource && <span className="font-semibold text-white">{topPointsSource.label}</span>}
              </div>
              <div className="space-y-2">
                {pointsBreakdown.map((item) => (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                      topPointsSource?.key === item.key
                        ? 'border-primary/50 bg-primary/10 text-white'
                        : 'border-gray-700 bg-gray-800/70 text-gray-300'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="font-semibold">+{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
          <div className="mt-3">
            <ShareButton
              payload={{
                title: t('app.name'),
                text: shareText,
              }}
            />
          </div>
        </section>

        <section
          className="sticky bottom-0 z-10 mt-5 rounded-2xl border border-gray-700 bg-gray-800/95 p-3 backdrop-blur-sm"
          data-testid="results-action-tray"
        >
          <div className="flex flex-col gap-2.5">
            <Button
              onClick={handlePlayAgain}
              variant="primary"
              size="lg"
              fullWidth
            >
              {t('results.playAgain')}
            </Button>
            <Button
              onClick={() => navigate('/rankings')}
              variant="secondary"
              size="lg"
              fullWidth
            >
              {t('results.viewRankings')}
            </Button>
            <Button
              onClick={() => navigate('/menu')}
              variant="ghost"
              size="md"
              fullWidth
              className="py-2"
            >
              {t('common.backToMenu')}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
