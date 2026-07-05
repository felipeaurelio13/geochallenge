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
} from '../components';
import { Button } from '../components/atoms/Button';
import { MonumentAttribution } from '../components/MonumentAttribution';
import { generateFunFact } from '../utils/funFacts';
import { applyExtendedTime, getQuestionDuration } from '../utils/questionTiming';
import { useStreakShareImage } from '../hooks/useStreakShareImage';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useUiStore } from '../store/useUiStore';
import type { Question, DailyResult } from '../types';

const ANSWER_TIME = 20;

type PageState = 'loading' | 'already-played' | 'playing' | 'finished' | 'error';

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
  // QA fix HI-1: results acumulados por ronda — alimentan ProgressBar (los
  // dots 1..N rojos/verdes) y ScoreDisplay para que Daily tenga el mismo
  // feedback visual que GamePage (Single Player). Antes solo había
  // currentIndex y correctCount.
  const [results, setResults] = useState<Array<{ isCorrect: boolean; timedOut: boolean }>>([]);
  // Respuestas crudas para el backend: el servidor recalcula score/correctCount.
  const answersRef = useRef<Array<{ questionId: string; answer: string }>>([]);
  const [timedOut, setTimedOut] = useState(false);
  const [previousResult, setPreviousResult] = useState<DailyResult | null>(null);
  const [finalResult, setFinalResult] = useState<DailyResult | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (data.alreadyPlayed && data.result) {
          setPreviousResult(data.result);
          setPageState('already-played');
        } else {
          setQuestions(data.questions as Question[]);
          setPageState('playing');
        }
      })
      .catch(() => setPageState('error'));
  }, []);

  // QA fix HI-1: reset del time-remaining cuando cambia la pregunta.
  // El <Timer> componente maneja el tick interno, sólo lo re-inicializamos.
  useEffect(() => {
    if (pageState !== 'playing' || showResult) return;
    setTimeRemaining(applyExtendedTime(getQuestionDuration(currentQuestion?.category, ANSWER_TIME), extendedTimeEnabled));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, pageState, showResult, extendedTimeEnabled]);

  function handleSubmit(forcedAnswer?: string) {
    if (showResult) return;
    const answer = forcedAnswer ?? selected ?? '';
    const isCorrect = answer === currentQuestion?.correctAnswer;
    const isTimeout = !answer;
    if (currentQuestion) {
      answersRef.current.push({ questionId: currentQuestion.id, answer });
    }
    if (isCorrect) setCorrectCount((c) => c + 1);
    setResults((prev) => [...prev, { isCorrect, timedOut: isTimeout }]);
    setTimedOut(isTimeout);
    setShowResult(true);
  }

  function handleTimeComplete() {
    if (showResult) return;
    handleSubmit();
  }

  async function handleNext() {
    if (isLastQuestion) {
      const score = correctCount * 100;
      setShowResult(false);
      setPageState('finished');
      try {
        const result = await api.submitDaily({ answers: answersRef.current });
        setFinalResult(result.result);
      } catch {
        setFinalResult({ score, correctCount, totalQuestions: questions.length, playedAt: new Date().toISOString() });
      }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
      setShowResult(false);
      setTimedOut(false);
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

  if (pageState === 'already-played' && previousResult) {
    const pct = Math.round((previousResult.correctCount / previousResult.totalQuestions) * 100);
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-[var(--color-bg-app)] px-6 py-8 text-center">
        {/* 🗓️ (spiral) en vez de 📅 (calendar) — el segundo se renderiza como
            "JUL 17" hardcoded en muchos OS (QA design audit lo marcó como raro).
            El spiral es genérico, sin fecha. */}
        <div className="text-6xl">🗓️</div>
        <h1 className="text-2xl font-bold text-app-text">{t('daily.alreadyPlayed', '¡Reto de hoy completado! 🎯')}</h1>
        <p className="text-[var(--color-text-secondary)]">{t('daily.comeBackTomorrow', 'Mañana hay uno nuevo esperándote')}</p>
        <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="text-4xl font-black text-app-text">{previousResult.correctCount}/{previousResult.totalQuestions}</div>
          <div className="mt-1 text-[var(--color-text-secondary)]">{pct}% {t('results.accuracy')}</div>
          {previousResult.dailyStreak !== undefined && previousResult.dailyStreak >= 1 && (
            <div className="mt-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-3 py-2 text-sm text-cyan-300">
              🔥 <span className="font-bold tabular-nums">{previousResult.dailyStreak}</span>{' '}
              {previousResult.dailyStreak === 1
                ? t('daily.streakStart', '¡día! Vuelve mañana para seguir la racha')
                : t('daily.streakDays', { count: previousResult.dailyStreak, defaultValue: 'días seguidos' })}
            </div>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">{t('daily.nextChallengeAt', 'El próximo reto abre a medianoche (tu hora)')}</p>
        <Button onClick={() => handleShare(previousResult.correctCount)} disabled={shareStatus === 'sharing'} variant="primary" size="lg">
          📸 {t('results.shareStreakButton', 'Compartir resultado')}
        </Button>
        {shareFeedback && <p className="text-xs text-green-300">{shareFeedback}</p>}
        <Button onClick={() => navigate('/menu')} variant="ghost">{t('common.backToMenu')}</Button>
      </div>
    );
  }

  if (pageState === 'finished') {
    const result = finalResult;
    const pct = result ? Math.round((result.correctCount / result.totalQuestions) * 100) : 0;
    const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '👍' : '💪';
    // El streak se cortó (Part 2): solo mostramos el aviso cálido cuando la
    // racha anterior era significativa (>=2) — la misma racha de 0/1 no
    // amerita un mensaje de "pérdida", sería ruido.
    const showStreakLostNotice = Boolean(result?.streakLost) && (result?.previousStreak ?? 0) >= 2;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-[var(--color-bg-app)] px-6 py-8 text-center">
        <div className="text-6xl">{emoji}</div>
        <h1 className="text-2xl font-bold text-app-text">{t('daily.complete', '¡Reto del día completado!')}</h1>
        {showStreakLostNotice && (
          <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
            {t('daily.streakLostNotice', {
              count: result?.previousStreak,
              defaultValue: 'Tu racha de {{count}} días se cortó 💛 — hoy empieza una nueva. Lo importante es volver.',
            })}
          </p>
        )}
        {result && (
          <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="text-5xl font-black text-app-text">{result.correctCount}/{result.totalQuestions}</div>
            <div className="mt-1 text-[var(--color-text-secondary)]">{pct}% {t('results.accuracy')}</div>
            {/* Racha diaria — motivador de retención clave. Antes solo se mostraba
              cuando > 1 (silencioso en la primera partida), QA round 3 lo marcó
              como faltante. Ahora siempre aparece: día 1 invita a volver mañana,
              días subsiguientes celebran la continuidad. */}
            {result.dailyStreak !== undefined && result.dailyStreak >= 1 && (
              <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
                <div className="flex items-center justify-center gap-2 text-cyan-300">
                  <span className="text-xl">🔥</span>
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
          📸 {t('results.shareStreakButton', 'Compartir resultado')}
        </Button>
        {shareFeedback && <p className="text-xs text-green-300">{shareFeedback}</p>}
        <Button onClick={() => navigate('/menu')} variant="ghost">{t('common.backToMenu')}</Button>
      </div>
    );
  }

  if (!currentQuestion) return null;

  // QA fix HI-1 + ME-2: ahora Daily comparte scaffold con GamePage. Mismo
  // header (Exit · Score · Timer), misma ProgressBar 1..N, mismas opciones
  // verticales en 1 columna, mismo RoundActionTray con feedback "Correcto" /
  // "Incorrecto" / "Tiempo agotado". El timeout ya no muestra "Incorrect"
  // genérico — distingue claramente que no fue un error sino tiempo expirado.
  return (
    <>
    {confirmDialog}
    <a href="#game-options" className="skip-link">
      {t('common.skipToAnswerOptions')}
    </a>
    <GameRoundScaffold
      header={
        <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 pb-2 pt-3 backdrop-blur sm:px-4 sm:pb-3 sm:pt-4">
          <div className="max-w-4xl mx-auto grid grid-cols-[auto_1fr_auto] items-center gap-2.5 sm:gap-4">
            <button
              onClick={async () => { if (await confirm(t('game.confirmExit'))) navigate('/menu'); }}
              className="pressable min-h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs sm:text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label={t('game.exit')}
            >
              ✕ {t('game.exit')}
            </button>
            <div className="text-center">
              <ScoreDisplay
                score={score}
                previousScore={previousScore}
                showAnimation={showResult}
                lastResult={null}
              />
              <p className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-cyan-400">
                {t('menu.dailyChallenge', 'Reto del día')}
              </p>
            </div>
            <div className="justify-self-end pr-[max(env(safe-area-inset-right),0.5rem)] sm:pr-[max(env(safe-area-inset-right),0.75rem)] md:pr-0">
              <Timer
                duration={roundDuration}
                timeRemaining={timeRemaining}
                onTick={setTimeRemaining}
                onComplete={handleTimeComplete}
                isActive={!showResult && pageState === 'playing'}
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
      onOptionSelect={(opt) => { if (!showResult) setSelected(opt); }}
      showResult={showResult}
      actionTray={
        <RoundActionTray
          mode="single"
          showResult={showResult}
          canSubmit={!!selected}
          submitLabel={t('game.submit')}
          nextLabel={isLastQuestion ? t('daily.finish', 'Ver resultado') : t('game.next')}
          // QA fix ME-2: distinguir timeout de respuesta incorrecta.
          resultLabel={
            timedOut
              ? t('game.timeUp', 'Tiempo agotado')
              : lastAnswerCorrect
                ? t('game.correct')
                : t('game.incorrect')
          }
          resultHint={funFact ?? undefined}
          resultAttribution={
            currentQuestion.category === 'MONUMENT'
              ? <MonumentAttribution question={currentQuestion} />
              : undefined
          }
          selectionAssistiveText={selected && !showResult ? t('game.selectionReadyShortHint') : undefined}
          showResultBadge
          isCorrect={lastAnswerCorrect}
          correctAnswer={showResult && !lastAnswerCorrect ? currentQuestion.correctAnswer : undefined}
          onSubmit={() => handleSubmit()}
          onNext={handleNext}
        />
      }
    />
    </>
  );
}
