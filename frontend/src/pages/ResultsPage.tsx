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
import { generateFunFact } from '../utils/funFacts';
import { CATEGORY_LABEL_KEYS } from '../utils/categoryLabels';
import { trackUxEvent } from '../utils/uxTelemetry';
import type { Category } from '../types';

export function ResultsPage({ isTrial = false }: { isTrial?: boolean }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, resetGame, lastNewAchievements } = useGame();
  const gameType = state.config?.gameType ?? searchParams.get('gameType') ?? 'single';
  const isStreakMode = gameType === 'streak';
  const isPracticeMode = gameType === 'practice';
  const category = state.config?.category ?? searchParams.get('category') ?? 'MIXED';
  const modeLabelKey = isTrial
    ? 'results.modeTrial'
    : isPracticeMode
      ? 'results.modePractice'
      : isStreakMode
        ? 'results.modeStreak'
        : 'results.modeSingle';
  const categoryLabelKey = CATEGORY_LABEL_KEYS[category as Category] ?? CATEGORY_LABEL_KEYS.MIXED;
  const { share: shareStreakImage, status: streakShareStatus } = useStreakShareImage();
  const [streakShareFeedback, setStreakShareFeedback] = useState('');
  const [allReviewOpen, setAllReviewOpen] = useState(false);
  const [showBackToSummary, setShowBackToSummary] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const reviewListRef = useRef<HTMLDivElement>(null);
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
  const categoryStats = useMemo(() => {
    const stats = new Map<Category, { correct: number; total: number }>();
    for (const result of results) {
      const question = questions.find((item) => item.id === result.questionId);
      if (!question) continue;
      const entry = stats.get(question.category) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (result.isCorrect) entry.correct += 1;
      stats.set(question.category, entry);
    }
    return Array.from(stats.entries())
      .map(([category, value]) => ({
        category,
        ...value,
        accuracy: Math.round((value.correct / value.total) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [questions, results]);
  const averageAnswerSeconds = useMemo(() => {
    const elapsed = results
      .map((result) => result.elapsedSeconds)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
    if (!elapsed.length) return null;
    return elapsed.reduce((sum, value) => sum + value, 0) / elapsed.length;
  }, [results]);
  const formattedAverageAnswerSeconds = averageAnswerSeconds === null
    ? null
    : averageAnswerSeconds.toLocaleString(currentLanguage, { maximumFractionDigits: 1 });
  const slowestAnswer = useMemo(() => {
    const timed = results.filter(
      (result): result is typeof result & { elapsedSeconds: number } =>
        typeof result.elapsedSeconds === 'number' &&
        Number.isFinite(result.elapsedSeconds) &&
        result.elapsedSeconds >= 0,
    );
    if (timed.length < 2) return null;
    const slowest = timed.reduce((max, result) => (
      result.elapsedSeconds > max.elapsedSeconds ? result : max
    ));
    const fastest = timed.reduce((min, result) => (
      result.elapsedSeconds < min.elapsedSeconds ? result : min
    ));
    if (slowest.elapsedSeconds === fastest.elapsedSeconds) return null;
    const question = questions.find((item) => item.id === slowest.questionId);
    if (!question) return null;
    return { question, seconds: slowest.elapsedSeconds };
  }, [questions, results]);
  const weakestCategory = categoryStats.find((stat) => stat.accuracy < 100) ?? null;
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

  const summaryHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const heading = summaryHeadingRef.current;
    if (!heading) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    heading.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const updateVisibility = () => {
      setShowBackToSummary(container.scrollHeight > container.clientHeight + 240);
    };
    updateVisibility();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateVisibility);
    observer?.observe(container);
    window.addEventListener('resize', updateVisibility);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateVisibility);
    };
  }, []);

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

  const toggleAllReview = () => {
    const next = !allReviewOpen;
    reviewListRef.current?.querySelectorAll('details').forEach((details) => {
      (details as HTMLDetailsElement).open = next;
    });
    setAllReviewOpen(next);
  };

  const handleBackToSummary = () => {
    const heading = summaryHeadingRef.current;
    if (!heading) return;
    heading.scrollIntoView?.({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
  };

  const handlePracticeCategory = (categoryToPlay: Category, source = 'results_category_row') => {
    const destination = `/game/single?category=${categoryToPlay}&gameType=single`;
    trackUxEvent('mode_selected', {
      destination,
      gameMode: 'single',
      category: categoryToPlay,
      source,
    });
    resetGame();
    navigate(destination);
  };

  const handlePracticeWeakestCategory = () => {
    if (!weakestCategory) return;
    handlePracticeCategory(weakestCategory.category, 'results_category');
  };

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
    <div ref={scrollContainerRef} className="h-full min-h-0 overflow-y-auto bg-[var(--color-bg-app)] px-4 py-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:px-6 sm:py-8">
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
          <h1 ref={summaryHeadingRef} tabIndex={-1} className="mt-4 text-2xl font-semibold text-app-text outline-none sm:text-3xl">
            {isStreakMode ? t('results.streakHeadline', { count: correctAnswers }) : getPerformanceMessage()}
          </h1>
          <p className="mt-1 text-xs font-medium tracking-wide text-app-secondary">
            {t(modeLabelKey)} · {t(categoryLabelKey)}
          </p>
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
          {formattedAverageAnswerSeconds !== null && (
            <p className="mt-2 text-xs text-app-secondary">
              {t('results.averageTime')}:{' '}
              <span className="font-semibold tabular-nums text-app-text">
                {t('results.averageTimeValue', { seconds: formattedAverageAnswerSeconds })}
              </span>
            </p>
          )}
          {slowestAnswer && (
            <p className="mt-1 text-xs text-app-secondary">
              {t('results.slowestQuestion', {
                question: getLocalizedQuestionText(slowestAnswer.question, t, currentLanguage),
                seconds: slowestAnswer.seconds.toLocaleString(currentLanguage, { maximumFractionDigits: 1 }),
              })}
            </p>
          )}
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

        {categoryStats.length >= 2 && (
          <section className="mt-6 border-t border-app-border pt-5" aria-labelledby="category-accuracy-title">
            <h2 id="category-accuracy-title" className="text-lg font-semibold text-app-text">
              {t('results.categoryAccuracyTitle')}
            </h2>
            <p className="mt-1 text-sm text-app-secondary">{t('results.categoryAccuracyDescription')}</p>
            <ul className="mt-3 space-y-2">
              {categoryStats.map(({ category, correct, total, accuracy }) => (
                <li key={category} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 break-words text-app-text">{t(CATEGORY_LABEL_KEYS[category])}</span>
                  <span className="shrink-0 tabular-nums text-app-secondary">
                    {t('results.categoryAccuracyValue', { correct, total, accuracy })}
                  </span>
                  {!isTrial && (
                    <button
                      type="button"
                      onClick={() => handlePracticeCategory(category)}
                      className="min-h-11 shrink-0 rounded-md px-2 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary/80"
                      aria-label={t('results.playCategory', { category: t(CATEGORY_LABEL_KEYS[category]) })}
                    >
                      {t('results.playCategoryShort')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!isTrial && weakestCategory && (
              <Button variant="secondary" fullWidth className="mt-3" onClick={handlePracticeWeakestCategory}>
                {t('results.practiceWeakest', { category: t(CATEGORY_LABEL_KEYS[weakestCategory.category]) })}
              </Button>
            )}
          </section>
        )}

        {mistakes.length > 0 && (
          <section className="mt-6 border-t border-app-border pt-5" aria-labelledby="review-title">
            <div className="flex items-start justify-between gap-3">
              <h2 id="review-title" className="text-lg font-semibold text-app-text">
                {t('results.reviewTitle')}
                <span className="ml-2 align-middle text-xs font-normal text-app-secondary">
                  {t(mistakes.length === 1 ? 'results.reviewCountOne' : 'results.reviewCountMany', { count: mistakes.length })}
                </span>
              </h2>
              {mistakes.length >= 2 && (
                <button
                  type="button"
                  onClick={toggleAllReview}
                  className="mt-0.5 min-h-11 shrink-0 rounded-md px-2 text-sm font-medium text-primary hover:text-primary/80"
                >
                  {t(allReviewOpen ? 'results.collapseAll' : 'results.expandAll')}
                </button>
              )}
            </div>
            <p className="mt-1 text-sm text-app-secondary">{t('results.reviewDescription')}</p>
            <div ref={reviewListRef} className="mt-4 space-y-2">
              {mistakes.map(({ result, question, number }) => {
                const funFact = generateFunFact(
                  question,
                  currentLanguage === 'en' ? 'en' : 'es',
                  result.correctAnswer,
                );
                return (
                <details key={result.questionId} className="rounded-lg border border-app-border bg-app-surface p-3">
                  <summary className="min-h-11 cursor-pointer text-sm font-medium text-app-text">
                    {number}. {getLocalizedQuestionText(question, t, currentLanguage)}
                    <span className="ml-2 inline-block align-middle rounded-full border border-app-border bg-app-muted px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-app-secondary">
                      {t(CATEGORY_LABEL_KEYS[question.category])}
                    </span>
                  </summary>
                  <div className="mt-3 flex items-start gap-3 border-t border-app-border pt-3">
                    {question.imageUrl && (
                      <img src={question.imageUrl} alt={t('game.questionImageAlt', { category: question.category.toLowerCase() })} className="h-16 w-20 shrink-0 rounded object-contain" loading="lazy" />
                    )}
                    <dl className="min-w-0 space-y-2 break-words text-sm">
                      <div><dt className="text-app-secondary">{t('results.yourAnswer')}</dt><dd className="text-app-text">{question.category === 'MAP' && result.distance != null ? t('results.mapDistance', { distance: Math.round(result.distance).toLocaleString(currentLanguage) }) : result.userAnswer || t('results.noAnswer')}</dd></div>
                      {typeof result.elapsedSeconds === 'number' && Number.isFinite(result.elapsedSeconds) && (
                        <div><dt className="text-app-secondary">{t('results.answerTime')}</dt><dd className="text-app-text">{t('results.averageTimeValue', { seconds: result.elapsedSeconds.toLocaleString(currentLanguage) })}</dd></div>
                      )}
                      <div><dt className="text-app-secondary">{t('game.correctAnswerWas')}</dt><dd className="font-semibold text-success">{result.correctAnswer}</dd></div>
                      {funFact && (
                        <div>
                          <dt className="text-app-secondary">{t('results.funFactLabel')}</dt>
                          <dd className="text-app-text">{funFact}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </details>
                );
              })}
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

        {showBackToSummary && (
          <div className="mt-6 border-t border-app-border pt-4 text-center">
            <button
              type="button"
              onClick={handleBackToSummary}
              className="min-h-11 rounded-md px-3 text-sm font-medium text-primary hover:text-primary/80"
            >
              {t('results.backToSummary')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
