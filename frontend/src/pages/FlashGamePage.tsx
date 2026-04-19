import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { FlashCard, LoadingSpinner, StreakCombo } from '../components';
import { FullScreenError } from '../components/molecules/FullScreenError';
import { Button } from '../components/atoms/Button';
import { useHaptics } from '../hooks';
import type { Question } from '../types';

const FALLBACK_DURATION_SECONDS = 60;
const FEEDBACK_MS = 320;
const FLASH_COMBO_TIERS = [1, 1, 2, 2, 3, 3, 5, 5, 8, 8, 10];
const FLASH_BASE_POINTS = 10;

function flashMultiplier(combo: number): number {
  const index = Math.max(0, Math.floor(combo));
  return FLASH_COMBO_TIERS[Math.min(index, FLASH_COMBO_TIERS.length - 1)];
}

type Status = 'loading' | 'intro' | 'playing' | 'finished';

interface FlashRoundResult {
  questionId: string;
  isCorrect: boolean;
  points: number;
  combo: number;
}

export function FlashGamePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptics = useHaptics();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(FALLBACK_DURATION_SECONDS);
  const [timeRemaining, setTimeRemaining] = useState(FALLBACK_DURATION_SECONDS);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [results, setResults] = useState<FlashRoundResult[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<Status>(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Load flash session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.startFlashGame();
        if (cancelled) return;
        setQuestions(response.questions);
        const duration = response.gameConfig.durationSeconds ?? FALLBACK_DURATION_SECONDS;
        setDurationSeconds(duration);
        setTimeRemaining(duration);
        setStatus('intro');
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'No se pudo iniciar Flash');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = useCallback(() => {
    if (statusRef.current === 'finished') return;
    setStatus('finished');
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    haptics.celebrate();
  }, [haptics]);

  // Timer
  useEffect(() => {
    if (status !== 'playing') return;
    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          finish();
          return 0;
        }
        if (next <= 5) {
          haptics.urgency();
        }
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, finish, haptics]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const startPlaying = () => {
    setStatus('playing');
  };

  const currentQuestion = questions[currentIndex];

  const handleAnswer = useCallback(
    (option: string) => {
      if (!currentQuestion || status !== 'playing') return;
      const isCorrect =
        option.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();

      const prevCombo = combo;
      const effectiveCombo = isCorrect ? prevCombo + 1 : 0;
      const multiplier = flashMultiplier(prevCombo);
      const points = isCorrect ? FLASH_BASE_POINTS * multiplier : 0;

      setCombo(effectiveCombo);
      setMaxCombo((prev) => Math.max(prev, effectiveCombo));
      setScore((prev) => prev + points);
      setAnswered((prev) => prev + 1);
      setResults((prev) => [
        ...prev,
        { questionId: currentQuestion.id, isCorrect, points, combo: effectiveCombo },
      ]);
      setFeedback(isCorrect ? 'correct' : 'incorrect');

      if (isCorrect) {
        haptics.success();
        if (effectiveCombo > 0 && effectiveCombo % 5 === 0) {
          haptics.celebrate();
        }
      } else {
        haptics.error();
      }

      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedback(null);
        setCurrentIndex((idx) => {
          const next = idx + 1;
          if (next >= questions.length) {
            finish();
            return idx;
          }
          return next;
        });
      }, FEEDBACK_MS);
    },
    [combo, currentQuestion, finish, haptics, questions.length, status]
  );

  const progressPercent = useMemo(
    () => Math.max(0, Math.min(100, (timeRemaining / durationSeconds) * 100)),
    [timeRemaining, durationSeconds]
  );

  const multiplier = flashMultiplier(combo);

  if (status === 'loading') {
    return (
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Cargando Flash..." />
      </div>
    );
  }

  if (error) {
    return (
      <FullScreenError
        title="Error"
        message={error}
        backTo="/menu"
        backLabel={t('common.backToMenu')}
      />
    );
  }

  if (status === 'intro') {
    return (
      <div className="h-full min-h-0 bg-gray-900 px-4 py-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl border border-gray-700 bg-gray-800/95 p-6 text-center shadow-2xl">
            <div className="text-7xl" aria-hidden="true">⚡</div>
            <h1 className="mt-3 text-3xl font-black text-white">Flash</h1>
            <p className="mt-2 text-gray-300">
              60 segundos. Banderas y siluetas. Tap o swipe. Encadena aciertos para multiplicar x10.
            </p>
            <ul className="mt-4 space-y-2 text-left text-sm text-gray-300">
              <li>⏱️ <strong className="text-white">60s</strong> totales, no por pregunta</li>
              <li>👉 Swipe izq/der o toca la opción</li>
              <li>🔥 Combo x1 → x2 → x3 → x5 → x8 → x10</li>
              <li>❌ Fallar resetea el combo, no termina la partida</li>
            </ul>
            <Button onClick={startPlaying} variant="primary" size="lg" fullWidth className="mt-6">
              ¡Empezar!
            </Button>
            <Button
              onClick={() => navigate('/menu')}
              variant="ghost"
              size="md"
              fullWidth
              className="mt-2"
            >
              {t('common.backToMenu')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'finished') {
    const correct = results.filter((r) => r.isCorrect).length;
    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    const qpm = answered; // per-60s already

    return (
      <div className="h-full min-h-0 overflow-y-auto bg-gray-900 px-4 py-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl border border-gray-700 bg-gray-800/95 p-6 text-center shadow-2xl">
            <div className="text-6xl" aria-hidden="true">⚡</div>
            <h1 className="mt-2 text-2xl font-black text-white">¡Flash terminado!</h1>
            <div className="mt-5 rounded-2xl border border-primary/40 bg-gray-900/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                Puntuación
              </p>
              <p className="mt-1 text-5xl font-black text-white">{score.toLocaleString()}</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border border-gray-700 bg-gray-900/80 p-3">
                <div className="text-2xl font-bold text-amber-400">{maxCombo}</div>
                <div className="text-xs text-gray-400">Combo máx</div>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-900/80 p-3">
                <div className="text-2xl font-bold text-green-400">{correct}</div>
                <div className="text-xs text-gray-400">Aciertos</div>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-900/80 p-3">
                <div className="text-2xl font-bold text-white">{accuracy}%</div>
                <div className="text-xs text-gray-400">Precisión</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-400">{qpm} preguntas respondidas</p>

            <Button
              onClick={() => {
                setResults([]);
                setScore(0);
                setCombo(0);
                setMaxCombo(0);
                setAnswered(0);
                setCurrentIndex(0);
                setTimeRemaining(durationSeconds);
                setStatus('intro');
              }}
              variant="primary"
              size="lg"
              fullWidth
              className="mt-5"
            >
              Jugar otra vez
            </Button>
            <Button
              onClick={() => navigate('/menu')}
              variant="secondary"
              size="md"
              fullWidth
              className="mt-2"
            >
              {t('common.backToMenu')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // playing
  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-900 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:px-4">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => {
              if (window.confirm(t('game.confirmExit'))) navigate('/menu');
            }}
            className="pressable min-h-10 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
            aria-label={t('game.exit')}
          >
            ✕
          </button>
          <StreakCombo combo={combo} multiplier={multiplier} label="Combo" />
          <div
            className="tabular-nums rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-semibold text-white"
            aria-live="off"
          >
            {timeRemaining}s
          </div>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800" aria-hidden="true">
          <div
            className={`h-full transition-[width] duration-1000 ease-linear ${
              progressPercent > 50
                ? 'bg-green-500'
                : progressPercent > 25
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm text-gray-300">
          <span>
            ⚡ <span className="tabular-nums font-bold text-white">{score}</span>
          </span>
          <span className="tabular-nums text-gray-400">#{answered + 1}</span>
        </div>
      </div>

      <div className="mx-auto mt-3 flex w-full max-w-md flex-1 min-h-0">
        {currentQuestion && (
          <FlashCard
            key={currentQuestion.id}
            question={currentQuestion}
            onAnswer={handleAnswer}
            disabled={feedback !== null}
            feedback={feedback}
          />
        )}
      </div>
    </div>
  );
}
