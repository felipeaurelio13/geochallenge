import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { LoadingSpinner, Timer } from '../components';
import { Button } from '../components/atoms/Button';
import { trackUxEvent } from '../utils/uxTelemetry';
import type {
  WorldEventCurrentResponse,
  WorldEventBossStartResponse,
  WorldEventBossQuestion,
} from '../types';

type PageState = 'loading' | 'locked' | 'unlocked' | 'playing' | 'finished' | 'error';

const REGION_EMOJI: Record<string, string> = {
  AFRICA: '🌍',
  AMERICAS: '🌎',
  ASIA: '🌏',
  EUROPE: '🏰',
  OCEANIA: '🏝️',
};

const REGION_LABELS: Record<string, string> = {
  AFRICA: 'África',
  AMERICAS: 'Américas',
  ASIA: 'Asia',
  EUROPE: 'Europa',
  OCEANIA: 'Oceanía',
};

function formatTimeLeft(endsAt: string): string {
  const now = Date.now();
  const end = new Date(endsAt).getTime();
  const diff = end - now;
  if (diff <= 0) return 'Terminado';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

export function WorldEventPage() {
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [eventData, setEventData] = useState<WorldEventCurrentResponse | null>(null);
  const [bossData, setBossData] = useState<WorldEventBossStartResponse | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<WorldEventBossQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<Array<{ isCorrect: boolean; points: number }>>([]);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bossHp, setBossHp] = useState(7);
  const [timeRemaining, setTimeRemaining] = useState(20);

  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load event data
  useEffect(() => {
    api.getCurrentEvent()
      .then((data) => {
        setEventData(data);
        if (data.boss.unlocked) {
          setPageState('unlocked');
        } else {
          setPageState('locked');
        }
      })
      .catch(() => {
        setError('Error al cargar el evento');
        setPageState('error');
      });
  }, []);

  // Cleanup feedback timer
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const handleStartBoss = useCallback(async () => {
    try {
      setPageState('loading');
      const data = await api.startBoss();
      setBossData(data);
      setCurrentQuestion(data.question);
      setCorrectCount(data.correctCount);
      setScore(data.score);
      setBossHp(data.boss.hitsRequired - data.boss.hits);
      setTimeRemaining(data.timeLimit);
      setPageState('playing');

      trackUxEvent('game_started', {
        destination: '/event',
        gameMode: 'event_boss',
        category: 'MIXED',
      });
    } catch (err: any) {
      if (err?.code === 'EVENT_BOSS_LOCKED') {
        setPageState('locked');
      } else {
        setError('Error al iniciar el Boss');
        setPageState('error');
      }
    }
  }, []);

  const handleAnswer = useCallback(async (answer: string) => {
    if (!bossData || !currentQuestion || isSubmitting) return;

    setIsSubmitting(true);
    setSelected(answer);

    try {
      const result = await api.bossAnswer(bossData.attemptId, {
        questionId: currentQuestion.questionId,
        answer,
      });

      setLastAnswerCorrect(result.isCorrect);
      setLastCorrectAnswer(result.correctAnswer);
      setShowResult(true);

      if (result.isCorrect) {
        setBossHp((prev) => Math.max(0, prev - 1));
      }

      setResults((prev) => [...prev, { isCorrect: result.isCorrect, points: result.points }]);

      trackUxEvent('question_answered', {
        eventId: bossData.eventId,
        region: bossData.region,
        roundIndex: bossData.questionIndex,
        isCorrect: result.isCorrect,
        points: result.points,
        timedOut: false,
      });

      // Auto-advance after feedback
      feedbackTimerRef.current = setTimeout(() => {
        if (result.isFinal) {
          // Game finished
          setCorrectCount(result.correctCount);
          setScore(result.score);
          setPageState('finished');

          trackUxEvent('game_finished', {
            eventId: bossData.eventId,
            region: bossData.region,
            score: result.score,
            correctCount: result.correctCount,
            cleared: result.cleared ?? false,
          });
        } else {
          // Next question
          setCurrentQuestion(null);
          setSelected(null);
          setShowResult(false);

          // Load next question
          api.startBoss().then((data) => {
            setBossData(data);
            setCurrentQuestion(data.question);
            setTimeRemaining(data.timeLimit);
            setIsSubmitting(false);
          }).catch(() => {
            setError('Error al cargar siguiente pregunta');
            setPageState('error');
          });
        }
      }, 2000);
    } catch (err: any) {
      setError('Error al enviar respuesta');
      setIsSubmitting(false);
      setSelected(null);
    }
  }, [bossData, currentQuestion, isSubmitting]);

  const handleTimeout = useCallback(() => {
    handleAnswer('');
  }, [handleAnswer]);

  if (pageState === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <p className="text-app-secondary">{error}</p>
        <Button onClick={() => navigate('/menu')} variant="secondary">
          Volver al menú
        </Button>
      </div>
    );
  }

  if (pageState === 'locked' && eventData) {
    const { progress, event } = eventData;
    const region = event.region;
    const emoji = REGION_EMOJI[region] || '🌍';
    const regionName = REGION_LABELS[region] || region;

    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-6 text-center">
          <span className="text-4xl">{emoji}</span>
          <h1 className="mt-2 text-xl font-bold text-app-text">
            Expedición {regionName}
          </h1>
          <p className="mt-1 text-sm text-app-subtle">
            Termina en {formatTimeLeft(event.endsAt)}
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-app-text">Preparación</h2>

          <div className="rounded-xl border border-app-border bg-app-surface p-4">
            <div className="flex items-center gap-3">
              <span className={`text-lg ${progress.correctInRegion >= progress.correctRequired ? 'text-green-500' : 'text-app-subtle'}`}>
                {progress.correctInRegion >= progress.correctRequired ? '✓' : '○'}
              </span>
              <div>
                <p className="text-sm font-medium text-app-text">
                  {progress.correctInRegion} / {progress.correctRequired} respuestas correctas
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-app-border bg-app-surface p-4">
            <div className="flex items-center gap-3">
              <span className={`text-lg ${progress.distinctCategories >= progress.categoriesRequired ? 'text-green-500' : 'text-app-subtle'}`}>
                {progress.distinctCategories >= progress.categoriesRequired ? '✓' : '○'}
              </span>
              <div>
                <p className="text-sm font-medium text-app-text">
                  {progress.distinctCategories} / {progress.categoriesRequired} tipos de desafío
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-app-border bg-app-surface p-4">
            <div className="flex items-center gap-3">
              <span className={`text-lg ${progress.dailyCompleted ? 'text-green-500' : 'text-app-subtle'}`}>
                {progress.dailyCompleted ? '✓' : '○'}
              </span>
              <div>
                <p className="text-sm font-medium text-app-text">
                  Daily completado
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-app-border bg-app-surface p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <p className="text-sm font-medium text-app-text">Guardián bloqueado</p>
          </div>
          <p className="mt-1 text-xs text-app-subtle">
            Completa la preparación para desafiarlo.
          </p>
        </div>

        <Button
          onClick={() => navigate('/daily')}
          className="mt-4 w-full"
          variant="secondary"
        >
          Practicar {regionName}
        </Button>
      </div>
    );
  }

  if (pageState === 'unlocked' && eventData) {
    const { boss, event } = eventData;
    const region = event.region;
    const emoji = REGION_EMOJI[region] || '🌍';
    const regionName = REGION_LABELS[region] || region;

    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-6 text-center">
          <span className="text-4xl">{emoji}</span>
          <h1 className="mt-2 text-xl font-bold text-app-text">
            Expedición {regionName}
          </h1>
          {boss.cleared && (
            <p className="mt-1 text-sm text-green-500">
              Guardián derrotado
            </p>
          )}
        </div>

        {boss.cleared && (
          <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
            <p className="text-sm font-medium text-green-400">
              Mejor: {boss.bestCorrect} / 10
            </p>
            <p className="text-xs text-app-subtle">
              {boss.attempts} intento{boss.attempts !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <p className="text-sm font-medium text-app-text">
              {boss.cleared ? 'Guardián disponible' : 'Guardián desbloqueado'}
            </p>
          </div>
          <p className="mt-1 text-xs text-app-subtle">
            10 preguntas. Necesitas 7 golpes para derrotarlo.
          </p>
        </div>

        <Button
          onClick={handleStartBoss}
          className="mt-4 w-full"
        >
          {boss.cleared ? 'Jugar otra vez' : 'Enfrentar Guardián'}
        </Button>

        {!boss.cleared && (
          <Button
            onClick={() => navigate('/daily')}
            className="mt-2 w-full"
            variant="secondary"
          >
            Practicar {regionName}
          </Button>
        )}
      </div>
    );
  }

  if (pageState === 'playing' && bossData && currentQuestion) {
    const progress = results.length;
    const total = bossData.totalQuestions;

    return (
      <div className="mx-auto max-w-lg px-4 py-4">
        {/* Boss Header */}
        <div className="mb-4 text-center">
          <h1 className="text-lg font-bold text-app-text">
            🔥 Guardián de {REGION_LABELS[bossData.region] || bossData.region}
          </h1>
          <div className="mt-2 flex justify-center gap-1">
            {Array.from({ length: bossData.boss.hitsRequired }).map((_, i) => (
              <span
                key={i}
                className={`text-lg ${i < bossHp ? 'opacity-100' : 'opacity-30'}`}
              >
                ❤️
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-app-subtle">
            Pregunta {progress + 1} / {total}
          </p>
        </div>

        {/* Timer */}
        <div className="mb-4">
          <Timer
            duration={bossData.timeLimit}
            timeRemaining={timeRemaining}
            onTick={setTimeRemaining}
            onComplete={handleTimeout}
            isActive={!showResult}
          />
        </div>

        {/* Question */}
        <div className="mb-4 rounded-xl border border-app-border bg-app-surface p-4">
          <p className="text-sm font-medium text-app-text">
            {currentQuestion.questionText}
          </p>
          {currentQuestion.imageUrl && (
            <img
              src={currentQuestion.imageUrl}
              alt="Question"
              className="mt-2 max-h-40 rounded-lg object-contain"
            />
          )}
        </div>

        {/* Options */}
        <div className="space-y-2">
          {currentQuestion.options.map((option) => {
            const isSelected = selected === option;
            const isCorrectOption = showResult && option === lastCorrectAnswer;
            const isWrongSelected = showResult && isSelected && !lastAnswerCorrect;

            return (
              <button
                key={option}
                type="button"
                onClick={() => !showResult && handleAnswer(option)}
                disabled={showResult || isSubmitting}
                className={`w-full rounded-xl border p-3 text-left text-sm font-medium transition-all ${
                  isCorrectOption
                    ? 'border-green-500 bg-green-500/20 text-green-400'
                    : isWrongSelected
                    ? 'border-red-500 bg-red-500/20 text-red-400'
                    : isSelected
                    ? 'border-primary bg-primary/20 text-app-text'
                    : 'border-app-border bg-app-surface text-app-text hover:border-primary/50'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {showResult && (
          <div className="mt-4 rounded-xl border border-app-border bg-app-surface p-3 text-center">
            <p className={`text-sm font-medium ${lastAnswerCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {lastAnswerCorrect ? '¡Correcto! +100' : 'Incorrecto'}
            </p>
            {!lastAnswerCorrect && (
              <p className="mt-1 text-xs text-app-subtle">
                Respuesta: {lastCorrectAnswer}
              </p>
            )}
          </div>
        )}

        {/* Score */}
        <div className="mt-4 text-center">
          <p className="text-sm text-app-subtle">
            Score: {score} | Golpes: {bossData.boss.hitsRequired - bossHp} / {bossData.boss.hitsRequired}
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'finished' && bossData) {
    const cleared = correctCount >= bossData.boss.hitsRequired;

    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-6 text-center">
          <span className="text-4xl">{cleared ? '🎉' : '💪'}</span>
          <h1 className="mt-2 text-xl font-bold text-app-text">
            {cleared ? 'Guardián Derrotado' : 'El Guardián Resiste'}
          </h1>
          <p className="mt-1 text-2xl font-bold text-app-text">
            {correctCount} / {bossData.totalQuestions}
          </p>
          <p className="text-sm text-app-subtle">
            {score} pts
          </p>
        </div>

        {cleared && (
          <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
            <p className="text-sm font-medium text-green-400">
              ¡Excelente trabajo!
            </p>
          </div>
        )}

        {!cleared && (
          <div className="mb-4 rounded-xl border border-app-border bg-app-surface p-4 text-center">
            <p className="text-sm text-app-secondary">
              Prepárate y vuelve a intentarlo.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Button onClick={handleStartBoss} className="w-full">
            Jugar otra vez
          </Button>
          <Button onClick={() => navigate('/menu')} variant="secondary" className="w-full">
            Volver al viaje
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
