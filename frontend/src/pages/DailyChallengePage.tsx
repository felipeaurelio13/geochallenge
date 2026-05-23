import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { LoadingSpinner } from '../components';
import { Button } from '../components/atoms/Button';
import { OptionButton } from '../components/OptionButton';
import { MonumentAttribution } from '../components/MonumentAttribution';
import { generateFunFact } from '../utils/funFacts';
import { useStreakShareImage } from '../hooks/useStreakShareImage';
import type { Question, DailyResult } from '../types';

const ANSWER_TIME = 20;

type PageState = 'loading' | 'already-played' | 'playing' | 'finished' | 'error';

export function DailyChallengePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { share: shareImage, status: shareStatus } = useStreakShareImage();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ANSWER_TIME);
  const [previousResult, setPreviousResult] = useState<DailyResult | null>(null);
  const [finalResult, setFinalResult] = useState<DailyResult | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentQuestion = questions[currentIndex] ?? null;
  const isLastQuestion = currentIndex === questions.length - 1;

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

  // Timer per question
  useEffect(() => {
    if (pageState !== 'playing' || showResult) return;
    setTimeLeft(ANSWER_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, pageState, showResult]);

  function handleSubmit(forcedAnswer?: string) {
    if (showResult) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const answer = forcedAnswer ?? selected ?? '';
    const isCorrect = answer === currentQuestion?.correctAnswer;
    if (isCorrect) setCorrectCount((c) => c + 1);
    setShowResult(true);
  }

  async function handleNext() {
    if (isLastQuestion) {
      const score = correctCount * 100;
      setShowResult(false);
      setPageState('finished');
      try {
        const result = await api.submitDaily({ score, correctCount, totalQuestions: questions.length });
        setFinalResult(result.result);
      } catch {
        setFinalResult({ score, correctCount, totalQuestions: questions.length, playedAt: new Date().toISOString() });
      }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
      setShowResult(false);
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
        <div className="text-6xl">📅</div>
        <h1 className="text-2xl font-bold text-app-text">{t('daily.alreadyPlayed', 'Ya jugaste hoy')}</h1>
        <p className="text-[var(--color-text-secondary)]">{t('daily.comeBackTomorrow', 'Vuelve mañana para el siguiente reto')}</p>
        <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="text-4xl font-black text-app-text">{previousResult.correctCount}/{previousResult.totalQuestions}</div>
          <div className="mt-1 text-[var(--color-text-secondary)]">{pct}% {t('results.accuracy')}</div>
          {previousResult.dailyStreak && previousResult.dailyStreak > 1 && (
            <div className="mt-3 text-sm text-cyan-400">🔥 {t('daily.streak', 'Racha')}: {previousResult.dailyStreak} {t('daily.days', 'días')}</div>
          )}
        </div>
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
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-[var(--color-bg-app)] px-6 py-8 text-center">
        <div className="text-6xl">{emoji}</div>
        <h1 className="text-2xl font-bold text-app-text">{t('daily.complete', '¡Reto del día completado!')}</h1>
        {result && (
          <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="text-5xl font-black text-app-text">{result.correctCount}/{result.totalQuestions}</div>
            <div className="mt-1 text-[var(--color-text-secondary)]">{pct}% {t('results.accuracy')}</div>
            {result.dailyStreak && result.dailyStreak > 1 && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-cyan-400">
                <span>🔥</span>
                <span>{t('daily.streak', 'Racha')}: <strong>{result.dailyStreak}</strong> {t('daily.days', 'días')}</span>
              </div>
            )}
          </div>
        )}
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

  const isCorrect = selected === currentQuestion.correctAnswer;

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-app)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
        <button
          onClick={() => { if (window.confirm(t('game.confirmExit'))) navigate('/menu'); }}
          className="text-xs text-[var(--color-text-secondary)] hover:text-app-text"
        >
          ✕ {t('game.exit')}
        </button>
        <div className="text-center">
          <div className="text-xs font-medium text-cyan-400">{t('menu.dailyChallenge', 'Reto del día')}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{currentIndex + 1} / {questions.length}</div>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className={`font-mono font-bold ${timeLeft <= 5 ? 'text-red-400' : 'text-app-text'}`}>{timeLeft}s</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-[var(--color-surface)]">
        <div
          className="h-full bg-cyan-500 transition-all duration-300"
          style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {currentQuestion.imageUrl && (
          <div className="mb-4 flex justify-center">
            <img
              src={currentQuestion.imageUrl}
              alt=""
              className="max-h-40 w-auto rounded-xl object-contain"
            />
          </div>
        )}
        <h2 className="mb-4 text-center text-lg font-semibold text-app-text">
          {currentQuestion.questionText}
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {currentQuestion.options.map((opt, idx) => {
            const isSelected = selected === opt;
            const isCorrectOpt = opt === currentQuestion.correctAnswer;
            return (
              <OptionButton
                key={opt}
                option={opt}
                index={idx}
                selected={isSelected}
                disabled={showResult}
                isCorrect={showResult ? isCorrectOpt : undefined}
                showResult={showResult}
                onClick={() => !showResult && setSelected(opt)}
              />
            );
          })}
        </div>
      </main>

      {/* Action tray */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {showResult ? (
          <div className="flex flex-col gap-2">
            <p className={`text-center text-sm font-semibold ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {isCorrect ? t('game.correct') : `${t('game.incorrect')} — ${currentQuestion.correctAnswer}`}
            </p>
            {funFact && <p className="text-center text-xs text-[var(--color-text-secondary)]">{funFact}</p>}
            {currentQuestion.category === 'MONUMENT' && (
              <div className="text-center text-[0.65rem] text-gray-400">
                <MonumentAttribution question={currentQuestion} />
              </div>
            )}
            <Button onClick={handleNext} variant="primary" size="lg" fullWidth>
              {isLastQuestion ? t('daily.finish', 'Ver resultado') : t('game.next')}
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => handleSubmit()}
            disabled={!selected}
            variant="primary"
            size="lg"
            fullWidth
          >
            {t('game.submit')}
          </Button>
        )}
      </div>
    </div>
  );
}
