import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/atoms/Button';
import { FlagDisplay } from '../components/FlagDisplay';
import { OptionButton } from '../components/OptionButton';
import { ProgressBar } from '../components/ProgressBar';
import { Timer } from '../components/Timer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { FullScreenError } from '../components/molecules/FullScreenError';
import { PageTemplate } from '../components/templates/PageTemplate';
import { api } from '../services/api';
import type {
  FlagMasterFinishResponse,
  FlagMasterRound,
  FlagMasterRoundResult,
  FlagModifier,
} from '../types';

type PageStatus = 'loading' | 'playing' | 'finished' | 'error';

const ROUND_RESULT_DELAY_MS = 1400;
const TIME_PER_QUESTION_FALLBACK = 10;

interface RecordedAnswer {
  questionId: string;
  answer: string;
  timeRemaining: number;
  /** Calculado en cliente para feedback inmediato; el servidor recalcula al finalizar. */
  isCorrectClientSide: boolean;
}

const TIER_ACCENTS: Record<number, { defaultLabel: string; chip: string }> = {
  1: {
    defaultLabel: 'Calentamiento',
    chip: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  },
  2: {
    defaultLabel: 'Sin color',
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  },
  3: {
    defaultLabel: 'Zoom',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  },
  4: {
    defaultLabel: 'Trampa',
    chip: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  },
  5: {
    defaultLabel: 'Final',
    chip: 'bg-red-500/15 text-red-300 border-red-500/40',
  },
};

const MODIFIER_DESC_KEYS: Record<FlagModifier, { key: string; fallback: string }> = {
  none: { key: 'flagMaster.modifierDesc.none', fallback: 'Sin trucos. Solo banderas difíciles.' },
  grayscale: {
    key: 'flagMaster.modifierDesc.grayscale',
    fallback: 'En blanco y negro: nada de color.',
  },
  crop: { key: 'flagMaster.modifierDesc.crop', fallback: 'Solo ves una parte de la bandera.' },
  similar: {
    key: 'flagMaster.modifierDesc.similar',
    fallback: 'Las 4 opciones son banderas casi iguales.',
  },
  combined: {
    key: 'flagMaster.modifierDesc.combined',
    fallback: 'Todo apilado: recorte, sin color y opciones tramposas.',
  },
};

export function FlagMasterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [gameId, setGameId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<FlagMasterRound[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [answers, setAnswers] = useState<RecordedAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TIME_PER_QUESTION_FALLBACK);
  const [timePerQuestion, setTimePerQuestion] = useState(TIME_PER_QUESTION_FALLBACK);
  const [finishResult, setFinishResult] = useState<FlagMasterFinishResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Snapshot estable: las funciones de avance leen estos refs para no depender
  // de la closure (que cambia en cada render y rompe scheduleAdvance).
  const stateRef = useRef({ roundIndex: 0, isLastRound: false, gameId: null as string | null });

  const currentRound: FlagMasterRound | null = rounds[roundIndex] ?? null;
  const isLastRound = rounds.length > 0 && roundIndex >= rounds.length - 1;

  useEffect(() => {
    stateRef.current = { roundIndex, isLastRound, gameId };
  }, [roundIndex, isLastRound, gameId]);

  // ─── Lifecycle: load game ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setStatus('loading');
    api
      .startFlagMaster()
      .then((res) => {
        if (!mounted) return;
        setGameId(res.gameId);
        setRounds(res.rounds);
        const tpq = res.timePerQuestion || TIME_PER_QUESTION_FALLBACK;
        setTimePerQuestion(tpq);
        setTimeRemaining(tpq);
        setStatus('playing');
      })
      .catch((err: Error) => {
        if (!mounted) return;
        setErrorMessage(err.message || t('flagMaster.errorLoading', 'No se pudo iniciar Flag Master'));
        setStatus('error');
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Reset time when round changes ───────────────────────────────────────
  useEffect(() => {
    setTimeRemaining(timePerQuestion);
  }, [roundIndex, timePerQuestion]);

  // ─── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const submitFinish = useCallback(
    async (finalAnswers: RecordedAnswer[]) => {
      const currentGameId = stateRef.current.gameId;
      if (!currentGameId) return;
      setSubmitting(true);
      try {
        const result = await api.finishFlagMaster({
          gameId: currentGameId,
          answers: finalAnswers.map((a) => ({
            questionId: a.questionId,
            answer: a.answer,
            timeRemaining: a.timeRemaining,
          })),
        });
        setFinishResult(result);
        setStatus('finished');
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : t('flagMaster.errorFinishing', 'No se pudo guardar el resultado')
        );
        setStatus('error');
      } finally {
        setSubmitting(false);
      }
    },
    [t]
  );

  const scheduleAdvance = useCallback(
    (snapshotAnswers: RecordedAnswer[]) => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        if (stateRef.current.isLastRound) {
          void submitFinish(snapshotAnswers);
        } else {
          setRoundIndex((idx) => idx + 1);
          setSelectedAnswer(null);
          setShowResult(false);
        }
      }, ROUND_RESULT_DELAY_MS);
    },
    [submitFinish]
  );

  const recordAndAdvance = useCallback(
    (answer: string) => {
      if (!currentRound) return;
      const isCorrect =
        answer.trim().length > 0 &&
        answer.trim().toLowerCase() === currentRound.correctAnswer.trim().toLowerCase();
      const recorded: RecordedAnswer = {
        questionId: currentRound.id,
        answer,
        timeRemaining: Math.max(0, Math.round(timeRemaining * 10) / 10),
        isCorrectClientSide: isCorrect,
      };
      const nextAnswers = (() => {
        const next = [...answers];
        next[roundIndex] = recorded;
        return next;
      })();
      setAnswers(nextAnswers);
      scheduleAdvance(nextAnswers);
    },
    [answers, currentRound, roundIndex, scheduleAdvance, timeRemaining]
  );

  const handleOptionClick = useCallback(
    (option: string) => {
      if (showResult || !currentRound) return;
      setSelectedAnswer(option);
      setShowResult(true);
      recordAndAdvance(option);
    },
    [showResult, currentRound, recordAndAdvance]
  );

  const handleTimeout = useCallback(() => {
    if (showResult || !currentRound) return;
    setSelectedAnswer(null);
    setShowResult(true);
    recordAndAdvance('');
  }, [showResult, currentRound, recordAndAdvance]);

  // ─── Render: loading ────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <PageTemplate>
        <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3">
          <LoadingSpinner />
          <p className="text-sm text-app-subtle">
            {t('flagMaster.preparing', 'Preparando 10 banderas difíciles...')}
          </p>
        </div>
      </PageTemplate>
    );
  }

  if (status === 'error') {
    return (
      <FullScreenError
        emoji="🏳️"
        title={t('flagMaster.errorTitle', 'No se pudo iniciar Flag Master')}
        message={errorMessage ?? ''}
        onRetry={() => window.location.reload()}
        retryLabel={t('flagMaster.retry', 'Reintentar')}
        backTo="/menu"
        backLabel={t('flagMaster.backToMenu', 'Volver al menú')}
      />
    );
  }

  if (status === 'finished' && finishResult) {
    return <FlagMasterResults result={finishResult} onPlayAgain={() => window.location.reload()} />;
  }

  if (!currentRound) {
    return null;
  }

  // ─── Render: playing ─────────────────────────────────────────────────────
  const tier = currentRound.tier;
  const accent = TIER_ACCENTS[tier] ?? TIER_ACCENTS[1];
  const accumulatedScore = answers.reduce(
    (sum, a) => (a.isCorrectClientSide ? sum + 100 : sum),
    0
  );

  // ProgressBar usa la forma { isCorrect } por slot ya respondido.
  const progressResults = answers.map((a) => ({ isCorrect: a.isCorrectClientSide }));

  return (
    <PageTemplate contentClassName="pb-4">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-2 py-2 sm:gap-4 sm:px-4">
        {/* Header: exit + round counter + score */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('flagMaster.confirmExit', '¿Seguro? Perderás tu progreso.'))) {
                navigate('/menu');
              }
            }}
            className="rounded-full border border-app-border bg-app-surface/80 px-3 py-1.5 text-xs text-app-subtle hover:text-red-400"
            aria-label={t('flagMaster.exit', 'Salir')}
          >
            ✕
          </button>
          <div className="flex flex-1 items-center justify-center gap-2 text-xs text-app-subtle">
            <span className="font-mono">
              {roundIndex + 1} / {rounds.length}
            </span>
          </div>
          <div className="rounded-full border border-app-border bg-app-surface/80 px-3 py-1.5 text-xs font-bold text-app-text tabular-nums">
            ≈ {accumulatedScore}
          </div>
        </div>

        <ProgressBar
          current={roundIndex + 1}
          total={rounds.length}
          results={progressResults}
          showCurrentResult={showResult}
        />

        {/* Tier badge */}
        <div className="flex items-center justify-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${accent.chip}`}
          >
            <span>{t(`flagMaster.tier.${tier}`, accent.defaultLabel)}</span>
            <span className="opacity-70">·</span>
            <span className="font-mono tabular-nums">x{currentRound.multiplier.toFixed(1)}</span>
          </span>
        </div>
        <p className="-mt-1 text-center text-[0.7rem] text-app-subtle sm:text-xs">
          {t(
            MODIFIER_DESC_KEYS[currentRound.flagModifier].key,
            MODIFIER_DESC_KEYS[currentRound.flagModifier].fallback
          )}
        </p>

        {/* Flag with modifier */}
        <FlagDisplay
          key={currentRound.id}
          imageUrl={currentRound.imageUrl}
          modifier={currentRound.flagModifier}
          questionId={currentRound.id}
        />

        {/* Question text */}
        <h2 className="text-center text-lg font-bold text-app-text sm:text-xl">
          {t('flagMaster.question', '¿A qué país pertenece esta bandera?')}
        </h2>

        {/* Timer */}
        <div className="flex justify-center">
          <Timer
            duration={timePerQuestion}
            timeRemaining={Math.max(0, Math.ceil(timeRemaining))}
            onTick={(t) => setTimeRemaining(t)}
            onComplete={handleTimeout}
            isActive={!showResult && status === 'playing'}
          />
        </div>

        {/* Options grid */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
          {currentRound.options.map((option, idx) => (
            <OptionButton
              key={`${currentRound.id}-${option}`}
              option={option}
              index={idx}
              disabled={showResult}
              selected={selectedAnswer === option}
              isCorrect={option === currentRound.correctAnswer}
              showResult={showResult}
              onClick={() => handleOptionClick(option)}
            />
          ))}
        </div>

        {/* Result hint */}
        {showResult && (
          <p className="text-center text-sm text-app-subtle">
            {selectedAnswer === null
              ? t('flagMaster.timeout', 'Tiempo agotado.')
              : selectedAnswer === currentRound.correctAnswer
              ? t('flagMaster.correct', '¡Correcto!')
              : t('flagMaster.wrong', 'Incorrecto.')}{' '}
            <span className="text-app-text/80">
              {t('flagMaster.wasAnswer', 'Era')}: <strong>{currentRound.correctAnswer}</strong>
            </span>
          </p>
        )}

        {submitting && (
          <p className="text-center text-xs text-app-subtle">
            {t('flagMaster.savingResult', 'Guardando resultado...')}
          </p>
        )}
      </div>
    </PageTemplate>
  );
}

// ─── Results screen ─────────────────────────────────────────────────────────

interface ResultsProps {
  result: FlagMasterFinishResponse;
  onPlayAgain: () => void;
}

function FlagMasterResults({ result, onPlayAgain }: ResultsProps) {
  const { t } = useTranslation();
  const byTier = useMemo(() => groupByTier(result.rounds), [result.rounds]);

  return (
    <PageTemplate contentClassName="pb-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-3 py-4 sm:px-4">
        <div className="text-center">
          <p className="text-sm text-app-subtle">
            {t('flagMaster.summaryTitle', 'Maestro de Banderas — resultado')}
          </p>
          <h1 className="mt-1 text-4xl font-extrabold text-app-text tabular-nums sm:text-5xl">
            {result.totalScore.toLocaleString()}
          </h1>
          <p className="mt-1 text-sm text-app-subtle">
            {result.correctCount} / {result.totalQuestions} {t('flagMaster.correctSuffix', 'correctas')} ·{' '}
            {result.accuracy}%
          </p>
          {result.isHighScore && (
            <p className="mt-2 inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
              🏆 {t('flagMaster.newHighScore', '¡Nuevo récord personal!')}
            </p>
          )}
          {result.degraded && (
            <p className="mt-2 text-xs text-amber-300/80">
              ⚠️ {result.message || t('flagMaster.degraded', 'Score verificado parcialmente (caché caída).')}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/80 p-3 sm:p-4">
          <h2 className="mb-2 text-sm font-bold text-app-text">
            {t('flagMaster.breakdownTitle', 'Desglose por tier')}
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(byTier).map(([tierStr, group]) => {
              const tier = Number(tierStr);
              const accent = TIER_ACCENTS[tier] ?? TIER_ACCENTS[1];
              const tierCorrect = group.filter((r) => r.isCorrect).length;
              const tierPoints = group.reduce((s, r) => s + r.points, 0);
              return (
                <div
                  key={tier}
                  className="flex items-center gap-3 rounded-xl border border-app-border bg-app-surface/60 p-2.5"
                >
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold sm:text-xs ${accent.chip}`}
                  >
                    {t(`flagMaster.tier.${tier}`, accent.defaultLabel)}
                  </span>
                  <div className="flex-1 text-xs text-app-subtle">
                    {tierCorrect} / {group.length} · x{group[0].multiplier.toFixed(1)}
                  </div>
                  <div className="font-mono text-sm font-bold text-app-text tabular-nums">
                    +{tierPoints}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 p-3 sm:p-4">
          <h2 className="mb-2 text-sm font-bold text-app-text">
            {t('flagMaster.roundsTitle', 'Ronda por ronda')}
          </h2>
          <div className="flex flex-col divide-y divide-app-border/40">
            {result.rounds.map((r, idx) => (
              <div key={`${r.questionId}-${idx}`} className="flex items-center gap-2 py-2 text-xs">
                <span className="w-5 text-app-subtle tabular-nums">{idx + 1}</span>
                <span className={r.isCorrect ? 'text-green-400' : 'text-red-400'}>
                  {r.isCorrect ? '✓' : '✕'}
                </span>
                <span className="flex-1 truncate text-app-text">{r.correctAnswer}</span>
                <span className="text-app-subtle">
                  {t(`flagMaster.modifier.${r.modifier}`, r.modifier)}
                </span>
                <span className="ml-2 font-mono tabular-nums text-app-text">+{r.points}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={onPlayAgain}>{t('flagMaster.playAgain', 'Jugar de nuevo')}</Button>
          <Link
            to="/menu"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-app-border bg-app-surface px-6 text-sm font-semibold text-app-secondary transition-colors hover:border-app-border hover:bg-app-surface/60"
          >
            {t('flagMaster.backToMenu', 'Volver al menú')}
          </Link>
        </div>
      </div>
    </PageTemplate>
  );
}

function groupByTier(rounds: FlagMasterRoundResult[]): Record<number, FlagMasterRoundResult[]> {
  const out: Record<number, FlagMasterRoundResult[]> = {};
  for (const r of rounds) {
    if (!out[r.tier]) out[r.tier] = [];
    out[r.tier].push(r);
  }
  return out;
}
