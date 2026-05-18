import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGame } from '../context/GameContext';
import { api } from '../services/api';
import { LoadingSpinner, ShareButton } from '../components';
import { AnswerStatusBadge } from '../components/AnswerStatusBadge';
import { Button } from '../components/atoms/Button';
import { useStreakShareImage } from '../hooks/useStreakShareImage';

export function ResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isStreakMode = searchParams.get('gameType') === 'streak';
  const category = searchParams.get('category') ?? 'MIXED';
  const { state, resetGame } = useGame();
  const { share: shareStreakImage, status: streakShareStatus } = useStreakShareImage();
  const [streakShareFeedback, setStreakShareFeedback] = useState<string>('');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const totalQuestions = results.length || 1;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);
  const incorrectAnswers = results.filter((r) => !r.isCorrect).length;
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

  const handleShareStreak = useCallback(async () => {
    const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const result = await shareStreakImage({
      correctCount: correctAnswers,
      category,
      date: today,
      score,
    });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (result === 'shared') setStreakShareFeedback(t('share.shared', '¡Compartido!'));
    else if (result === 'downloaded') setStreakShareFeedback(t('share.downloaded', 'Imagen guardada'));
    else if (result === 'error') setStreakShareFeedback(t('share.error', 'No se pudo compartir'));
    feedbackTimer.current = setTimeout(() => setStreakShareFeedback(''), 3000);
  }, [shareStreakImage, correctAnswers, category, score, t]);

  const handlePlayAgain = () => {
    resetGame();
    navigate('/menu');
  };

  if (questions.length === 0 && !loading) {
    navigate('/menu');
    return null;
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-bg-app)] px-4 py-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:px-6 sm:py-8">
      <main className="mx-auto w-full max-w-xl animate-fade-in" aria-label="results-summary">
        <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center shadow-2xl shadow-black/30 sm:p-8">
          <div className="text-6xl sm:text-7xl mb-3 animate-scale-in" aria-hidden="true">{getPerformanceEmoji()}</div>

          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] sm:text-4xl">{t('results.gameOver')}</h1>
          <p className="mt-2 text-lg text-[var(--color-text-secondary)] sm:text-xl">{getPerformanceMessage()}</p>

          <div className="mt-6 rounded-2xl border border-primary/35 bg-[var(--color-surface-muted)] p-5">
            <p className="text-sm font-medium uppercase tracking-wide text-primary/80">{t('game.score')}</p>
            <div className="mt-1 text-5xl font-black text-white sm:text-6xl">{score.toLocaleString()}</div>
            <div className="mt-1 text-[var(--color-text-muted)]">{t('results.points')}</div>
          </div>

          <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-left">
            <div className="mb-2 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
              <span>{t('results.accuracy')}</span>
              <span className="font-semibold text-white">{percentage}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--color-surface)] p-0.5" data-testid="results-accuracy-bar">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-400 via-emerald-400 to-primary transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {isStreakMode ? (
            <div className="mt-6 flex justify-center">
              <article className="min-w-0 w-36 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center sm:p-4">
                <div className="text-2xl font-bold text-green-400">{correctAnswers}</div>
                <div className="mt-2 flex justify-center min-w-0">
                  <AnswerStatusBadge
                    status="correct"
                    label={t('results.correct')}
                    className="justify-center text-2xs-token sm:text-xs"
                  />
                </div>
              </article>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
              <article className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4">
                <div className="text-2xl font-bold text-green-400">{correctAnswers}</div>
                <div className="mt-2 flex justify-center min-w-0">
                  <AnswerStatusBadge
                    status="correct"
                    label={t('results.correct')}
                    className="w-full justify-center text-2xs-token sm:text-xs"
                  />
                </div>
              </article>
              <article className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4">
                <div className="text-2xl font-bold text-red-400">{incorrectAnswers}</div>
                <div className="mt-2 flex justify-center min-w-0">
                  <AnswerStatusBadge
                    status="incorrect"
                    label={t('results.incorrect')}
                    className="w-full justify-center text-2xs-token sm:text-xs"
                  />
                </div>
              </article>
            </div>
          )}

          {pointsBreakdown.length > 0 && (
            <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-left">
              <div className="mb-2 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
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
                        : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]'
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
            <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-text-secondary)]">
              {t('rankings.empty')}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
          <p className="text-sm text-[var(--color-text-secondary)]">{t('results.shareScore')}</p>
          <div className="mt-3">
            {isStreakMode ? (
              <div>
                <Button
                  onClick={handleShareStreak}
                  disabled={streakShareStatus === 'sharing'}
                  variant="primary"
                  size="lg"
                  fullWidth
                >
                  📸 {streakShareStatus === 'sharing' ? `${t('common.loading')}...` : t('results.shareStreakButton', 'Compartir mi racha')}
                </Button>
                <p className="mt-2 min-h-5 text-xs text-green-300" aria-live="polite">
                  {streakShareFeedback}
                </p>
              </div>
            ) : (
              <ShareButton
                payload={{
                  title: t('app.name'),
                  text: shareText,
                }}
              />
            )}
          </div>
        </section>

        <section
          className="sticky bottom-0 z-10 mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
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
