import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import {
  LoadingSpinner,
  GameRoundScaffold,
  RoundActionTray,
  ProgressBar,
  ScoreDisplay,
  Timer,
  DailyTourStrip,
} from '../components';
import { Button } from '../components/atoms/Button';
import { GeoIcon } from '../components/atoms/GeoIcon';
import { GeoMark } from '../components/atoms/GeoMark';
import { MonumentAttribution } from '../components/MonumentAttribution';
import { generateFunFact } from '../utils/funFacts';
import { applyExtendedTime, getQuestionDuration } from '../utils/questionTiming';
import { useStreakShareImage } from '../hooks/useStreakShareImage';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useUiStore } from '../store/useUiStore';
import { getLocalizedCountryName } from '../utils/countryNames';
import { trackUxEvent } from '../utils/uxTelemetry';
import type { Question, DailyResult } from '../types';

const ANSWER_TIME = 20;

type PageState = 'loading' | 'briefing' | 'already-played' | 'playing' | 'finished' | 'error';

function regionLabel(region: string, t: (k: string) => string): string {
  const key = `geoChallenges.regions.${region}`;
  const translated = t(key);
  if (translated.startsWith('geoChallenges')) return region;
  return translated;
}

export function DailyChallengePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { share: shareImage, status: shareStatus } = useStreakShareImage();
  const { confirm, confirmDialog } = useConfirmDialog();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [results, setResults] = useState<Array<{ isCorrect: boolean; timedOut: boolean }>>([]);
  const [timedOut, setTimedOut] = useState(false);
  const [previousResult, setPreviousResult] = useState<DailyResult | null>(null);
  const [finalResult, setFinalResult] = useState<DailyResult | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState('');
  const [lastCountryCode, setLastCountryCode] = useState<string | null>(null);
  const [lastRegion, setLastRegion] = useState<string | null>(null);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [lockedAnswer, setLockedAnswer] = useState(false);
  const [roundSubmitError, setRoundSubmitError] = useState<string | null>(null);
  const [finishSubmitError, setFinishSubmitError] = useState(false);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [tourStops, setTourStops] = useState<Array<{ region: string; category: string }>>([]);

  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageStateRef = useRef<PageState>(pageState);
  pageStateRef.current = pageState;
  const abandonTrackedRef = useRef(false);
  const pendingAnswerRef = useRef<{ questionId: string; answer: string } | null>(null);

  const extendedTimeEnabled = useUiStore((s) => s.extendedTimeEnabled);

  const currentQuestion = questions[currentIndex] ?? null;
  const isLastQuestion = currentIndex === questions.length - 1;
  const roundDuration = applyExtendedTime(
    getQuestionDuration(currentQuestion?.category, ANSWER_TIME),
    extendedTimeEnabled
  );
  const [timeRemaining, setTimeRemaining] = useState(roundDuration);
  const score = correctCount * 100;
  const previousScore = score - (results.length > 0 && results[results.length - 1]?.isCorrect ? 100 : 0);
  const lastAnswerCorrect = results.length > 0 ? results[results.length - 1]?.isCorrect ?? false : false;

  useEffect(() => {
    api.getDaily()
      .then((data) => {
        setDayKey(data.dayKey ?? data.today);
        if (data.tour) {
          setTourStops(data.tour.stops.map((s) => ({ region: s.region, category: s.category })));
        }
        if (data.alreadyPlayed && data.result) {
          setPreviousResult(data.result);
          setPageState('already-played');
        } else {
          setQuestions(data.questions as Question[]);
          setPageState('briefing');
        }
      })
      .catch(() => setPageState('error'));
  }, []);

  useEffect(() => {
    return () => {
      if (!abandonTrackedRef.current && pageStateRef.current === 'playing') {
        abandonTrackedRef.current = true;
        trackUxEvent('game_abandoned', {
          mode: 'single',
          variant: 'DAILY',
          roundIndex: currentIndex,
          reason: 'navigation',
        });
      }
    };
  }, []);

  useEffect(() => {
    if (pageState !== 'playing' || showResult) return;
    setTimeRemaining(applyExtendedTime(getQuestionDuration(currentQuestion?.category, ANSWER_TIME), extendedTimeEnabled));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, pageState, showResult, extendedTimeEnabled]);

  async function handleSubmit(forcedAnswer?: string) {
    if (showResult || isSubmittingAnswer || lockedAnswer) return;
    const answer = forcedAnswer ?? selected ?? '';
    const isTimeout = !answer;

    setLockedAnswer(true);
    setIsSubmittingAnswer(true);
    setRoundSubmitError(null);
    pendingAnswerRef.current = { questionId: currentQuestion?.id ?? '', answer };

    try {
      const res = await api.dailyAnswer({
        questionId: currentQuestion!.id,
        answer,
        dayKey: dayKey ?? undefined,
      });
      if (res.isCorrect) setCorrectCount((c) => c + 1);
      setResults((prev) => [...prev, { isCorrect: res.isCorrect, timedOut: isTimeout }]);
      setLastCorrectAnswer(res.correctAnswer);
      setTimedOut(isTimeout);
      setLastCountryCode(res.countryCode ?? null);
      setLastRegion(res.region ?? null);
      setShowResult(true);
    } catch {
      setRoundSubmitError('network');
      // Keep selection locked, don't advance, don't show fake feedback
    } finally {
      setIsSubmittingAnswer(false);
    }
  }

  async function handleRetrySubmit() {
    if (!pendingAnswerRef.current) return;
    setRoundSubmitError(null);
    setIsSubmittingAnswer(true);
    try {
      const { questionId, answer } = pendingAnswerRef.current;
      const res = await api.dailyAnswer({ questionId, answer, dayKey: dayKey ?? undefined });
      if (res.isCorrect) setCorrectCount((c) => c + 1);
      setResults((prev) => [...prev, { isCorrect: res.isCorrect, timedOut: !answer }]);
      setLastCorrectAnswer(res.correctAnswer);
      setTimedOut(!answer);
      setLastCountryCode(res.countryCode ?? null);
      setLastRegion(res.region ?? null);
      setShowResult(true);
      pendingAnswerRef.current = null;
    } catch {
      setRoundSubmitError('network');
    } finally {
      setIsSubmittingAnswer(false);
    }
  }

  function handleTimeComplete() {
    if (showResult) return;
    handleSubmit('');
  }

  async function handleNext() {
    if (isLastQuestion) {
      setShowResult(false);
      setFinishSubmitError(false);
      try {
        const result = await api.submitDaily({ dayKey: dayKey! });
        setFinalResult(result.result);
        setPageState('finished');
        abandonTrackedRef.current = true;
      } catch {
        setFinishSubmitError(true);
        // Stay in playing state, don't show fake result
      }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
      setShowResult(false);
      setTimedOut(false);
      setLastCountryCode(null);
      setLastRegion(null);
      setLockedAnswer(false);
      setRoundSubmitError(null);
      pendingAnswerRef.current = null;
    }
  }

  async function handleRetryFinish() {
    setFinishSubmitError(false);
    try {
      const result = await api.submitDaily({ dayKey: dayKey! });
      setFinalResult(result.result);
      setPageState('finished');
      abandonTrackedRef.current = true;
    } catch {
      setFinishSubmitError(true);
    }
  }

  async function handleShare(correct: number) {
    const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const result = await shareImage({ correctCount: correct, category: 'DAILY', date: today });
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (result === 'shared') setShareFeedback(t('share.shared'));
    else if (result === 'downloaded') setShareFeedback(t('share.downloaded', 'Imagen guardada'));
    else if (result === 'error') setShareFeedback(t('share.error'));
    feedbackTimerRef.current = setTimeout(() => setShareFeedback(''), 3000);
  }

  const funFact = showResult && currentQuestion
    ? generateFunFact(currentQuestion, i18n.language === 'en' ? 'en' : 'es')
    : null;

  if (pageState === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--color-bg-app)]">
        <LoadingSpinner size="lg" text={t('common.loading')} />
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--color-bg-app)] p-6 text-center">
        <p className="text-app-text">{t('error.unexpected')}</p>
        <Button onClick={() => navigate('/menu')} variant="secondary">{t('common.backToMenu')}</Button>
      </div>
    );
  }

  if (pageState === 'briefing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-[var(--color-bg-app)] px-6 py-8 text-center">
        <GeoMark className="h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold text-app-text">{t('daily.worldTourTitle', 'Vuelta al mundo de hoy')}</h1>
        <p className="text-[var(--color-text-secondary)]">
          {t('daily.worldTourDesc', '10 paradas · 5 regiones · 1 intento')}
        </p>
        <div className="h-px w-16 bg-primary/40" aria-hidden="true" />
        <p className="text-sm text-[var(--color-text-muted)]">
          {t('daily.worldTourShared', 'El mismo recorrido para todos')}
        </p>
        {previousResult?.dailyStreak !== undefined && previousResult.dailyStreak >= 1 && (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
            <GeoIcon name="life" size={15} /> {previousResult.dailyStreak} {t('daily.streakDays', { count: previousResult.dailyStreak, defaultValue: 'días seguidos' })}
          </div>
        )}
        <Button
          onClick={() => {
            setPageState('playing');
          }}
          variant="primary"
          size="lg"
        >
          {t('daily.startJourney', 'Comenzar viaje')}
        </Button>
        <Button onClick={() => navigate('/menu')} variant="ghost">{t('common.backToMenu')}</Button>
      </div>
    );
  }

  if (pageState === 'already-played' && previousResult) {
    const pct = Math.round((previousResult.correctCount / previousResult.totalQuestions) * 100);
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-[var(--color-bg-app)] px-6 py-8 text-center">
        <GeoMark className="h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold text-app-text">{t('daily.alreadyPlayed', 'Reto de hoy completado')}</h1>
        <p className="text-[var(--color-text-secondary)]">{t('daily.comeBackTomorrow', 'Mañana hay uno nuevo esperándote')}</p>
        <div className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="text-4xl font-black text-app-text">{previousResult.correctCount}/{previousResult.totalQuestions}</div>
          <div className="mt-1 text-[var(--color-text-secondary)]">{pct}% {t('results.accuracy')}</div>
          {previousResult.details && previousResult.details.length === 10 && (
            <div className="mt-3">
              <DailyTourStrip details={previousResult.details} language={i18n.language} />
            </div>
          )}
          {previousResult.dailyStreak !== undefined && previousResult.dailyStreak >= 1 && (
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              <GeoIcon name="life" size={15} /> <span className="font-bold tabular-nums">{previousResult.dailyStreak}</span>{' '}
              {previousResult.dailyStreak === 1
                ? t('daily.streakStart', '¡día! Vuelve mañana para seguir la racha')
                : t('daily.streakDays', { count: previousResult.dailyStreak, defaultValue: 'días seguidos' })}
            </div>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">{t('daily.nextChallengeAt', 'El próximo reto abre a medianoche (tu hora)')}</p>
        <Button onClick={() => handleShare(previousResult.correctCount)} disabled={shareStatus === 'sharing'} variant="primary" size="lg">
          {t('results.shareStreakButton', 'Compartir resultado')}
        </Button>
        {shareFeedback && <p className="text-xs text-success-500">{shareFeedback}</p>}
        <Button onClick={() => navigate('/passport')} variant="secondary">{t('results.viewPassport', 'Ver pasaporte')}</Button>
        <Button onClick={() => navigate('/menu')} variant="ghost">{t('common.backToMenu')}</Button>
      </div>
    );
  }

  if (pageState === 'finished') {
    const result = finalResult;
    const pct = result ? Math.round((result.correctCount / result.totalQuestions) * 100) : 0;
    const showStreakLostNotice = Boolean(result?.streakLost) && (result?.previousStreak ?? 0) >= 2;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-[var(--color-bg-app)] px-6 py-8 text-center">
        <GeoMark className="h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold text-app-text">{t('daily.tourComplete', '¡Vuelta al mundo completada!')}</h1>
        {showStreakLostNotice && (
          <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
            {t('daily.streakLostNotice', {
              count: result?.previousStreak,
              defaultValue: 'Tu racha de {{count}} días se cortó 💛 — hoy empieza una nueva. Lo importante es volver.',
            })}
          </p>
        )}
        {result && (
          <div className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="text-5xl font-black text-app-text">{result.correctCount}/{result.totalQuestions}</div>
            <div className="mt-1 text-[var(--color-text-secondary)]">{pct}% {t('results.accuracy')}</div>
            {result.details && result.details.length === 10 && (
              <div className="mt-3">
                <DailyTourStrip details={result.details} language={i18n.language} />
                <p className="mt-2 text-xs text-[var(--color-text-muted)] text-center">
                  10 {t('daily.countriesVisited', 'países visitados')} · 5 {t('daily.regionsVisited', 'regiones')}
                </p>
              </div>
            )}
            {result.dailyStreak !== undefined && result.dailyStreak >= 1 && (
              <div className="mt-4 rounded-md border border-primary/30 bg-primary/10 p-3">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <GeoIcon name="life" size={18} />
                  <span className="text-2xl font-black tabular-nums">{result.dailyStreak}</span>
                  <span className="text-sm">
                    {result.dailyStreak === 1
                      ? t('daily.streakStart', '¡día! Vuelve mañana para seguir la racha')
                      : t('daily.streakDays', { count: result.dailyStreak, defaultValue: 'días seguidos' })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-[var(--color-text-muted)]">{t('daily.nextChallengeAt', 'El próximo reto abre a medianoche (tu hora)')}</p>
        <Button
          onClick={() => result && handleShare(result.correctCount)}
          disabled={shareStatus === 'sharing'}
          variant="primary"
          size="lg"
        >
          {t('results.shareStreakButton', 'Compartir resultado')}
        </Button>
        {shareFeedback && <p className="text-xs text-success-500">{shareFeedback}</p>}
        <Button onClick={() => navigate('/passport')} variant="secondary">{t('results.viewPassport', 'Ver pasaporte')}</Button>
        <Button onClick={() => navigate('/menu')} variant="ghost">{t('common.backToMenu')}</Button>
      </div>
    );
  }

  if (finishSubmitError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--color-bg-app)] p-6 text-center">
        <p className="text-app-text">{t('daily.finishError', 'No pudimos guardar tu recorrido')}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">{t('daily.finishErrorDesc', 'Tu progreso de las rondas sigue disponible.')}</p>
        <Button onClick={handleRetryFinish} variant="primary">{t('common.retry')}</Button>
        <Button onClick={() => navigate('/menu')} variant="ghost">{t('common.backToMenu')}</Button>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const currentStop = tourStops[currentIndex];
  const currentRegion = currentStop?.region ?? '';
  const correctAnswerForFeedback =
    ['FLAG', 'SILHOUETTE', 'MAP'].includes(currentQuestion.category)
      ? getLocalizedCountryName(lastCountryCode, i18n.language, lastCorrectAnswer)
      : lastCorrectAnswer;

  return (
    <>
    {confirmDialog}
    <a href="#game-options" className="skip-link">
      {t('common.skipToAnswerOptions')}
    </a>
    <GameRoundScaffold
      header={
        <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 pb-2 pt-3 sm:px-4 sm:pb-3 sm:pt-4">
          <div className="max-w-4xl mx-auto grid grid-cols-[auto_1fr_auto] items-center gap-2.5 sm:gap-4">
            <button
              onClick={async () => { if (await confirm(t('game.confirmExit'))) { abandonTrackedRef.current = true; trackUxEvent('game_abandoned', { mode: 'single', variant: 'DAILY', roundIndex: currentIndex, reason: 'navigation' }); navigate('/menu'); } }}
              className="pressable min-h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs sm:text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label={t('game.exit')}
            >
              <GeoIcon name="close" size={16} /> <span>{t('game.exit')}</span>
            </button>
            <div className="text-center">
              <ScoreDisplay
                score={score}
                previousScore={previousScore}
                showAnimation={showResult}
                lastResult={null}
              />
              <p className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-primary">
                {t('menu.dailyChallenge', 'Reto del día')}
              </p>
              {currentRegion && (
                <p className="text-[0.6rem] font-medium text-[var(--color-text-muted)]">
                  {t('daily.stopBadge', 'Parada {{current}} / {{total}}', { current: currentIndex + 1, total: questions.length })} · {regionLabel(currentRegion, t)}
                </p>
              )}
            </div>
            <div className="justify-self-end pr-[max(env(safe-area-inset-right),0.5rem)] sm:pr-[max(env(safe-area-inset-right),0.75rem)] md:pr-0">
              <Timer
                duration={roundDuration}
                timeRemaining={timeRemaining}
                onTick={setTimeRemaining}
                onComplete={handleTimeComplete}
                isActive={
                  !showResult
                  && !lockedAnswer
                  && !roundSubmitError
                  && !isSubmittingAnswer
                  && pageState === 'playing'
                }
              />
            </div>
          </div>
        </header>
      }
      progress={
        <div className="bg-[var(--color-surface-muted)] px-3 py-1 sm:px-4 sm:py-1.5">
          <div className="max-w-4xl mx-auto overflow-x-hidden">
            <ProgressBar
              current={currentIndex + 1}
              total={questions.length}
              results={results}
              showCurrentResult={showResult}
            />
          </div>
        </div>
      }
      question={currentQuestion}
      questionNumber={currentIndex + 1}
      totalQuestions={questions.length}
      compactQuestionCard
      isMapQuestion={false}
      mapContent={null}
      selectedAnswer={selected}
      correctAnswer={showResult && !roundSubmitError ? lastCorrectAnswer : undefined}
      onOptionSelect={(opt) => { if (!showResult && !lockedAnswer) setSelected(opt); }}
      showResult={showResult || !!roundSubmitError}
      actionTray={
        <RoundActionTray
          mode="single"
          showResult={showResult || !!roundSubmitError}
          canSubmit={!!selected && !lockedAnswer}
          submitLabel={t('game.submit')}
          nextLabel={roundSubmitError ? t('common.retry') : isLastQuestion ? t('daily.finish', 'Ver resultado') : t('game.next')}
          resultLabel={
            roundSubmitError
              ? t('daily.answerError', 'Error al enviar')
              : timedOut
                ? t('game.timeUp', 'Tiempo agotado')
                : lastAnswerCorrect
                  ? t('game.correct')
                  : t('game.incorrect')
          }
          resultHint={
            roundSubmitError
              ? t('daily.answerRetry', 'No pudimos registrar tu respuesta.')
              : showResult && lastCountryCode
                ? `${getLocalizedCountryName(lastCountryCode, i18n.language, lastCountryCode)} · ${regionLabel(lastRegion ?? '', t)}`
                : funFact ?? undefined
          }
          resultAttribution={
            currentQuestion.category === 'MONUMENT'
              ? <MonumentAttribution question={currentQuestion} />
              : undefined
          }
          selectionAssistiveText={selected && !showResult ? t('game.selectionReadyShortHint') : undefined}
          showResultBadge={!roundSubmitError}
          isCorrect={lastAnswerCorrect}
          correctAnswer={showResult && !roundSubmitError && !lastAnswerCorrect ? correctAnswerForFeedback : undefined}
          onSubmit={() => handleSubmit()}
          onNext={roundSubmitError ? handleRetrySubmit : handleNext}
        />
      }
    />
    </>
  );
}
