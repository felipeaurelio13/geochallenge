import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGame } from '../context/GameContext';
import { api } from '../services/api';
import { LoadingSpinner, ShareButton } from '../components';
import { Button } from '../components/atoms/Button';
import { useStreakShareImage } from '../hooks/useStreakShareImage';
import { uiStoreActions, useUiStore } from '../store/useUiStore';
import { getAchievementDisplay } from '../utils/achievements';
import { getLocalizedQuestionText } from '../utils/questionText';
import { trackUxEvent } from '../utils/uxTelemetry';

export function ResultsPage({ isTrial = false }: { isTrial?: boolean }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, resetGame, lastNewAchievements } = useGame();
  const gameType = state.config?.gameType ?? searchParams.get('gameType') ?? 'single';
  const isStreakMode = gameType === 'streak';
  const isPracticeMode = gameType === 'practice';
  const category = state.config?.category ?? searchParams.get('category') ?? 'MIXED';
  const { share: shareStreakImage, status: streakShareStatus } = useStreakShareImage();
  const [streakShareFeedback, setStreakShareFeedback] = useState('');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = useUiStore((s) => s.prefersReducedMotion);
  const hasToastedAchievements = useRef(false);
  const { score, questions, results } = state;
  const correctAnswers = results.filter((r) => r.isCorrect).length;
  const totalQuestions = results.length;
  const percentage = totalQuestions ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const currentLanguage = i18n?.language ?? 'es';
  const mistakes = results.flatMap((result, index) => {
    const question = questions.find((q) => q.id === result.questionId);
    return !result.isCorrect && question ? [{ result, question, number: index + 1 }] : [];
  });
  const bestStreak = results.reduce(
    (streak, result) => {
      const current = result.isCorrect ? streak.current + 1 : 0;
      return { current, best: Math.max(streak.best, current) };
    },
    { current: 0, best: 0 },
  ).best;
  const unlockedAchievements = useMemo(
    () => (lastNewAchievements ?? []).map((key) => getAchievementDisplay(key, currentLanguage)),
    [lastNewAchievements, currentLanguage],
  );

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  useEffect(() => {
    if (hasToastedAchievements.current || unlockedAchievements.length === 0 || isTrial) return;
    hasToastedAchievements.current = true;
    unlockedAchievements.slice(0, 2).forEach((achievement) => {
      uiStoreActions.pushToast({ type: 'achievement', message: `${achievement.icon} ${achievement.name}` });
    });
    if (unlockedAchievements.length > 2) {
      uiStoreActions.pushToast({
        type: 'achievement',
        message: t('results.moreAchievements', { count: unlockedAchievements.length - 2 }),
      });
    }
  }, [unlockedAchievements, t, isTrial]);

  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(!isPracticeMode && !isTrial);
  useEffect(() => {
    if (isPracticeMode || isTrial || results.length === 0) return;
    let active = true;
    api.getMyRank()
      .then((rankData) => { if (active) setUserRank(rankData.userRank?.rank || null); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isPracticeMode, isTrial, results.length]);

  const pointsBreakdown = [
    { key: 'basePoints', label: t('results.basePoints'), value: results.reduce((sum, r) => sum + (r.basePoints ?? 0), 0) },
    { key: 'timeBonus', label: t('results.timeBonus'), value: results.reduce((sum, r) => sum + (r.timeBonus ?? 0), 0) },
    { key: 'comboBonus', label: t('results.comboBonus'), value: results.reduce((sum, r) => sum + (r.comboBonus ?? 0), 0) },
    { key: 'accuracyBonus', label: t('results.accuracyBonus'), value: results.reduce((sum, r) => sum + (r.accuracyBonus ?? 0), 0) },
  ].filter((item) => item.value > 0);

  const shareText = t('results.shareText', {
    score, correct: correctAnswers, total: totalQuestions, accuracy: `${percentage}%`,
  });

  const getPerformanceMessage = () => {
    if (isStreakMode) {
      if (correctAnswers >= 10) return t('results.streakLong');
      if (correctAnswers >= 3) return t('results.streakMid');
      return t('results.streakShort');
    }
    if (percentage >= 90) return t('results.excellent');
    if (percentage >= 70) return t('results.great');
    if (percentage >= 50) return t('results.good');
    if (percentage >= 30) return t('results.keepPracticing');
    return t('results.growthMindset');
  };

  const handleShareStreak = useCallback(async () => {
    const result = await shareStreakImage({
      correctCount: correctAnswers, category, score,
      date: new Date().toLocaleDateString(currentLanguage, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (result === 'shared') setStreakShareFeedback(t('share.shared'));
    else if (result === 'downloaded') setStreakShareFeedback(t('share.downloaded'));
    else if (result === 'error') setStreakShareFeedback(t('share.error'));
    feedbackTimer.current = setTimeout(() => setStreakShareFeedback(''), 3000);
  }, [shareStreakImage, correctAnswers, category, score, t, currentLanguage]);

  const handlePlayAgain = (easy = false) => {
    const params = new URLSearchParams({ category, gameType });
    for (const key of ['continent', 'difficulty', 'isInsular', 'isLandlocked', 'countryCode']) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    if (easy) params.set('difficulty', 'EASY');
    const destination = isTrial ? '/play' : `/game/single?${params}`;
    trackUxEvent('mode_selected', { destination, gameMode: gameType, category, source: 'results', trial: isTrial });
    resetGame();
    navigate(destination);
  };

  if (questions.length === 0 || results.length === 0) {
    return <Navigate to={isTrial ? '/play' : '/menu'} replace />;
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-bg-app)] px-4 py-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:px-6 sm:py-8">
      <main className={`mx-auto w-full max-w-xl ${prefersReducedMotion ? '' : 'animate-fade-in'}`} aria-label="results-summary">
        <section className="text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-app-secondary">
            {t(isTrial ? 'results.trialLabel' : isPracticeMode ? 'results.practiceTitle' : 'results.gameOver')}
          </p>
          <div className="mx-auto flex h-36 w-36 flex-col items-center justify-center rounded-full border-4 border-primary/30 bg-primary/5 sm:h-40 sm:w-40">
            <span className="text-4xl font-bold tracking-tight tabular-nums text-primary sm:text-5xl">
              {isStreakMode ? correctAnswers : `${correctAnswers} / ${totalQuestions}`}
            </span>
            <span className="mt-1 text-xs text-app-secondary">{t('results.correct')}</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-app-text sm:text-3xl">
            {isStreakMode ? t('results.streakHeadline', { count: correctAnswers }) : getPerformanceMessage()}
          </h1>
          <p className="mt-2 text-sm text-app-secondary">
            {isTrial ? t('results.trialNotice') : isPracticeMode ? t('results.practiceSubtitle')
              : t(isStreakMode ? 'results.nextStreakGoal' : percentage === 100 ? 'results.perfectGoal' : 'results.nextGoal', {
                count: correctAnswers + 1, total: totalQuestions,
              })}
          </p>
          <div className="mt-5 grid grid-cols-3 divide-x divide-app-border border-y border-app-border py-3 text-center">
            <div className="px-2"><p className="text-lg font-semibold tabular-nums text-app-text">{percentage}%</p><p className="text-xs text-app-secondary">{t('results.accuracy')}</p></div>
            <div className="px-2"><p className="text-lg font-semibold tabular-nums text-app-text">{score.toLocaleString()}</p><p className="text-xs text-app-secondary">{t('results.points')}</p></div>
            <div className="px-2"><p className="text-lg font-semibold tabular-nums text-app-text">{bestStreak}</p><p className="text-xs text-app-secondary">{t('results.bestRun')}</p></div>
          </div>
        </section>

        <section className="mt-5 flex flex-col gap-2.5" data-testid="results-action-tray">
          <Button onClick={() => handlePlayAgain()} variant="primary" size="lg" fullWidth>
            {t(isPracticeMode ? 'results.continuePractice' : isStreakMode ? 'results.playAgainStreak' : 'results.playAgain')}
          </Button>
          {isTrial ? (
            <Button onClick={() => navigate('/register')} variant="secondary" size="lg" fullWidth>{t('results.createAccount')}</Button>
          ) : isPracticeMode ? (
            <Button onClick={() => navigate('/passport')} variant="secondary" fullWidth>{t('results.viewPassport')}</Button>
          ) : score === 0 && !isStreakMode ? (
            <Button onClick={() => handlePlayAgain(true)} variant="secondary" fullWidth>{t('results.tryEasy')}</Button>
          ) : null}
          <Button onClick={() => navigate(isTrial ? '/' : '/menu')} variant="ghost" fullWidth>
            {t(isTrial ? 'results.backHome' : 'common.backToMenu')}
          </Button>
        </section>

        {mistakes.length > 0 && (
          <section className="mt-6 border-t border-app-border pt-5" aria-labelledby="review-title">
            <h2 id="review-title" className="text-lg font-semibold text-app-text">{t('results.reviewTitle')}</h2>
            <p className="mt-1 text-sm text-app-secondary">{t('results.reviewDescription')}</p>
            <div className="mt-4 space-y-2">
              {mistakes.map(({ result, question, number }) => (
                <details key={result.questionId} className="rounded-lg border border-app-border bg-app-surface p-3">
                  <summary className="min-h-11 cursor-pointer text-sm font-medium text-app-text">
                    {number}. {getLocalizedQuestionText(question, t, currentLanguage)}
                    <span className="mt-1 block pl-4 font-normal text-primary">{result.correctAnswer}</span>
                  </summary>
                  <div className="mt-3 flex items-start gap-3 border-t border-app-border pt-3">
                    {question.imageUrl && (
                      <img src={question.imageUrl} alt={t('game.questionImageAlt', { category: question.category.toLowerCase() })} className="h-16 w-20 shrink-0 rounded object-contain" loading="lazy" />
                    )}
                    <dl className="min-w-0 space-y-2 break-words text-sm">
                      <div><dt className="text-app-secondary">{t('results.yourAnswer')}</dt><dd className="text-app-text">{question.category === 'MAP' && result.distance != null ? t('results.mapDistance', { distance: Math.round(result.distance).toLocaleString(currentLanguage) }) : result.userAnswer || t('results.noAnswer')}</dd></div>
                      <div><dt className="text-app-secondary">{t('game.correctAnswerWas')}</dt><dd className="font-semibold text-success">{result.correctAnswer}</dd></div>
                    </dl>
                  </div>
                </details>
              ))}
            </div>
            {!isTrial && !isPracticeMode && (
              <Button variant="secondary" fullWidth className="mt-3" onClick={() => { resetGame(); navigate('/game/single?gameType=practice'); }}>
                {t('results.practiceMistakes')}
              </Button>
            )}
          </section>
        )}

        {!isTrial && unlockedAchievements.length > 0 && (
          <section className="mt-6 rounded-lg border border-warning-500/40 bg-warning-500/10 p-4" data-testid="results-achievements">
            <h2 className="text-sm font-bold text-app-text">{t('results.achievementUnlocked')}</h2>
            <ul className="mt-3 space-y-3">
              {unlockedAchievements.map((achievement) => (
                <li key={achievement.key} className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">{achievement.icon}</span>
                  <div><p className="text-sm font-semibold text-app-text">{achievement.name}</p><p className="text-xs text-app-secondary">{achievement.description}</p></div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {pointsBreakdown.length > 0 && (
          <details className="mt-6 border-t border-app-border pt-4">
            <summary className="min-h-11 cursor-pointer text-sm font-medium text-app-secondary">{t('results.pointsBreakdownTitle')}</summary>
            <dl className="space-y-2 pb-3 text-sm">
              {pointsBreakdown.map((item) => <div key={item.key} className="flex justify-between gap-3"><dt className="text-app-secondary">{item.label}</dt><dd className="font-semibold text-app-text">+{item.value}</dd></div>)}
            </dl>
          </details>
        )}

        <section className="mt-5 border-t border-app-border pt-5">
          <p className="mb-3 text-sm text-app-secondary">{t('results.shareScore')}</p>
          {isStreakMode ? (
            <>
              <Button onClick={handleShareStreak} disabled={streakShareStatus === 'sharing'} variant="secondary" fullWidth>
                {streakShareStatus === 'sharing' ? t('common.loading') : t('results.shareStreakButton')}
              </Button>
              <p className="mt-2 text-xs text-success" aria-live="polite">{streakShareFeedback}</p>
            </>
          ) : <ShareButton variant="secondary" size="md" payload={{ title: t('app.name'), text: shareText }} />}
          {!isTrial && !isPracticeMode && (
            <div className="mt-4 flex items-center justify-between gap-3">
              {loading ? <LoadingSpinner size="sm" /> : userRank ? <p className="text-sm text-app-secondary">{t('results.yourRank')} <strong className="text-app-text">#{userRank}</strong></p> : null}
              <Button onClick={() => navigate('/rankings')} variant="ghost">{t('results.viewRankings')}</Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
