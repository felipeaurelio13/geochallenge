import { api, ApiError } from '../services/api';
import type {
  GeoChallengeAnswerResponse,
  GeoChallengeDifficulty,
  GeoChallengeFinishResponse,
  GeoChallengeKind,
  GeoChallengeRegion,
  GeoChallengeRound,
  GeoChallengeStartResponse,
  LocalizedText,
} from '../types';
import {
  LoadingSpinner,
  ProgressBar,
  ShareButton,
  Timer,
  UniversalGameLayout,
} from '../components';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/atoms/Button';
import { FullScreenError } from '../components/molecules/FullScreenError';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackUxEvent } from '../utils/uxTelemetry';

type PageStatus = 'loading' | 'briefing' | 'playing' | 'finished' | 'error';

interface RecordedAnswer {
  roundId: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
  kind: GeoChallengeKind;
  region: GeoChallengeRegion;
  explanation: LocalizedText;
  points: number;
}

const KIND_ICONS: Record<GeoChallengeKind, string> = {
  EXTREME: '🧭',
  HIGHER_LOWER: '⚖️',
  COMMON_NEIGHBOR: '🔗',
  ODD_ONE_OUT: '🕵️',
  NORTH_TO_SOUTH: '↕️',
  CAPITAL_PROXIMITY: '📍',
  ORDER_BY_METRIC: '📊',
  NEIGHBOR_COUNT: '🧩',
  BORDER_CHAIN: '⛓️',
};

const REGION_ICONS: Record<GeoChallengeRegion, string> = {
  AFRICA: '🌍',
  AMERICAS: '🌎',
  ASIA: '🌏',
  EUROPE: '🧭',
  OCEANIA: '🏝️',
};

const DIFFICULTY_STYLES: Record<GeoChallengeDifficulty, string> = {
  EASY: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
  MEDIUM: 'border-amber-500/35 bg-amber-500/10 text-amber-300',
  HARD: 'border-rose-500/35 bg-rose-500/10 text-rose-300',
};

function flagFromIso2(iso2: string): string {
  return iso2
    .toUpperCase()
    .split('')
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join('');
}

export function localizeGeoText(text: LocalizedText, language: string): string {
  return language.startsWith('en') ? text.en : text.es;
}

export function updateOrderedSelection(current: string[], optionId: string): string[] {
  return current.includes(optionId)
    ? current.filter((selectedId) => selectedId !== optionId)
    : [...current, optionId];
}

function getGeoChallengeErrorMessage(
  error: unknown,
  fallback: string,
  sessionExpired: string,
): string {
  return error instanceof ApiError && error.code === 'GEO_SESSION_EXPIRED'
    ? sessionExpired
    : fallback;
}

export function GeoChallengesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [game, setGame] = useState<GeoChallengeStartResponse | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<RecordedAnswer[]>([]);
  const [feedback, setFeedback] = useState<GeoChallengeAnswerResponse | null>(null);
  const [finishError, setFinishError] = useState(false);
  const [finishResult, setFinishResult] = useState<GeoChallengeFinishResponse | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(25);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [roundError, setRoundError] = useState('');
  const roundLockedRef = useRef(false);
  const statusRef = useRef<PageStatus>(status);
  statusRef.current = status;
  const abandonTrackedRef = useRef(false);

  const currentRound: GeoChallengeRound | null = game?.rounds[roundIndex] ?? null;
  const isLastRound = Boolean(game && roundIndex === game.rounds.length - 1);
  const isOrderedRound = currentRound?.selectionMode === 'ordered';
  const canSubmit = Boolean(currentRound) && (
    isOrderedRound
      ? selectedOptionIds.length === currentRound.options.length
      : selectedOptionIds.length === 1
  );
  const resultsForProgress = answers.map((answer) => ({ isCorrect: answer.isCorrect }));

  const loadGame = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const response = await api.startGeoChallenges();
      setGame(response);
      setRoundIndex(0);
      setSelectedOptionIds([]);
      setAnswers([]);
      setFeedback(null);
      setFinishResult(null);
      setTimeRemaining(response.timePerRound);
      roundLockedRef.current = false;
      setStatus('briefing');
    } catch (error) {
      setErrorMessage(getGeoChallengeErrorMessage(
        error,
        t('geoChallenges.errorLoading'),
        t('geoChallenges.sessionExpired'),
      ));
      setStatus('error');
    }
  }, [t]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (status === 'playing') event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status]);

  useEffect(() => {
    return () => {
      if (!abandonTrackedRef.current && statusRef.current === 'playing') {
        abandonTrackedRef.current = true;
        trackUxEvent('game_abandoned', {
          mode: 'single',
          variant: 'GEO_CHALLENGE',
          roundIndex,
          reason: 'navigation',
        });
      }
    };
  }, []);

  const handleOptionClick = (optionId: string) => {
    if (!currentRound || feedback || isSubmitting) return;
    setRoundError('');
    if (currentRound.selectionMode === 'ordered') {
      setSelectedOptionIds((current) => updateOrderedSelection(current, optionId));
    } else {
      setSelectedOptionIds([optionId]);
    }
  };

  const submitCurrentRound = useCallback(async (selection: string[] = selectedOptionIds) => {
    if (!game || !currentRound || roundLockedRef.current) return;
    roundLockedRef.current = true;
    setIsSubmitting(true);
    setRoundError('');
    try {
      const response = await api.submitGeoChallengeAnswer({
        sessionToken: game.sessionToken,
        roundId: currentRound.id,
        selectedOptionIds: selection,
      });
      setFeedback(response);
      setAnswers((current) => [
        ...current,
        {
          roundId: currentRound.id,
          selectedOptionIds: selection,
          isCorrect: response.isCorrect,
          kind: currentRound.kind,
          region: currentRound.region,
          explanation: response.explanation,
          points: response.points,
        },
      ]);
    } catch (error) {
      roundLockedRef.current = false;
      setRoundError(getGeoChallengeErrorMessage(
        error,
        t('geoChallenges.errorAnswering'),
        t('geoChallenges.sessionExpired'),
      ));
    } finally {
      setIsSubmitting(false);
    }
  }, [currentRound, game, selectedOptionIds, t]);

  const handleTimeComplete = useCallback(() => {
    if (!feedback && !isSubmitting && !roundLockedRef.current) {
      void submitCurrentRound([]);
    }
  }, [feedback, isSubmitting, submitCurrentRound]);

  const finishGame = useCallback(async (finalAnswers: RecordedAnswer[]) => {
    if (!game) return;
    setIsSubmitting(true);
    setFinishError(false);
    try {
      const result = await api.finishGeoChallenges({
        sessionToken: game.sessionToken,
        answers: finalAnswers.map(({ roundId, selectedOptionIds: ids }) => ({
          roundId,
          selectedOptionIds: ids,
        })),
      });
      setFinishResult(result);
      setStatus('finished');
      abandonTrackedRef.current = true;
    } catch {
      setFinishError(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [game]);

  const retryFinish = useCallback(async () => {
    if (!game) return;
    setFinishError(false);
    setIsSubmitting(true);
    try {
      const result = await api.finishGeoChallenges({
        sessionToken: game.sessionToken,
        answers: answers.map(({ roundId, selectedOptionIds: ids }) => ({
          roundId,
          selectedOptionIds: ids,
        })),
      });
      setFinishResult(result);
      setStatus('finished');
      abandonTrackedRef.current = true;
    } catch {
      setFinishError(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [game, answers]);

  const handleNext = async () => {
    if (!feedback || !game) return;
    if (isLastRound) {
      await finishGame(answers);
      return;
    }
    setRoundIndex((index) => index + 1);
    setSelectedOptionIds([]);
    setFeedback(null);
    setRoundError('');
    setTimeRemaining(game.timePerRound);
    roundLockedRef.current = false;
  };

  const correctAnswerLabel = useMemo(() => {
    if (!feedback || !currentRound) return '';
    return feedback.correctOptionIds
      .map((optionId) => currentRound.options.find((option) => option.id === optionId))
      .filter(Boolean)
      .map((option) => localizeGeoText(option!.label, i18n.language))
      .join(' → ');
  }, [currentRound, feedback, i18n.language]);

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--color-bg-app)] px-6">
        <LoadingSpinner size="lg" text={t('geoChallenges.preparing')} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <FullScreenError
        emoji="🧠"
        title={t('geoChallenges.errorTitle')}
        message={errorMessage}
        onRetry={() => void loadGame()}
      />
    );
  }

  if (status === 'briefing' && game) {
    const coveredRegions = new Set(game.rounds.map((r) => r.region));
    const uniqueRegionList = [...coveredRegions] as GeoChallengeRegion[];
    return (
      <div className="flex h-full min-h-0 overflow-y-auto bg-[var(--color-bg-app)] px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <main className="m-auto w-full max-w-lg">
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="pressable min-h-10 rounded-xl border border-app-border bg-app-surface px-3 text-xs font-semibold text-app-secondary"
          >
            ← {t('common.backToMenu')}
          </button>

          <section className="mt-4 overflow-hidden rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/15 via-indigo-500/10 to-transparent p-5 shadow-xl sm:p-7">
            <div className="inline-flex rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-fuchsia-300">
              {t('geoChallenges.briefingBadge')}
            </div>
            <div className="mt-4 text-5xl" aria-hidden="true">🧠🌍</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-app-text">{t('geoChallenges.title')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-app-secondary">{t('geoChallenges.briefingDesc')}</p>

            <div className="mt-5 grid grid-cols-5 gap-1.5" aria-label={t('geoChallenges.regionalCoverage')}>
              {uniqueRegionList.map((region) => (
                <div
                  key={region}
                  className="flex min-w-0 flex-col items-center rounded-xl border border-app-border bg-app-surface/75 px-1 py-2 text-center"
                  title={t(`geoChallenges.regions.${region}`)}
                >
                  <span className="text-xl" aria-hidden="true">{REGION_ICONS[region]}</span>
                  <span className="mt-1 w-full truncate text-[0.58rem] font-bold text-app-subtle">
                    {t(`geoChallenges.regions.${region}`)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-xs font-semibold text-emerald-300">
              ✓ {uniqueRegionList.length}/5 {t('geoChallenges.balancedRoute')}
            </p>
          </section>

          <section className="mt-3 grid grid-cols-2 gap-2" aria-label={t('geoChallenges.mechanicsPreview')}>
            {game.rounds.map((round) => (
              <div key={round.id} className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/10 text-xl" aria-hidden="true">
                  {KIND_ICONS[round.kind]}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.72rem] font-bold text-app-text sm:text-sm">{t(`geoChallenges.kinds.${round.kind}`)}</p>
                  <p className="truncate text-[0.68rem] text-app-subtle">
                    {REGION_ICONS[round.region]} {t(`geoChallenges.regions.${round.region}`)}
                  </p>
                </div>
              </div>
            ))}
          </section>

          <div className="mt-4 rounded-2xl border border-app-border bg-app-muted/70 p-3 text-center text-xs text-app-secondary">
            {t('geoChallenges.briefingRules', { rounds: game.rounds.length, seconds: game.timePerRound })}
          </div>
          <Button onClick={() => setStatus('playing')} fullWidth size="lg" className="mt-3">
            {t('geoChallenges.startJourney')}
          </Button>
          <Button
            onClick={() => navigate('/duel?mode=geo-challenge')}
            variant="secondary"
            fullWidth
            size="lg"
            className="mt-2"
          >
            ⚔️ {t('geoChallenges.playDuel')}
          </Button>
        </main>
      </div>
    );
  }

  if (finishError) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[var(--color-bg-app)] px-4">
        <main className="m-auto w-full max-w-md text-center">
          <div className="text-6xl" aria-hidden="true">⚠️</div>
          <h1 className="mt-3 text-2xl font-black text-app-text">{t('geoChallenges.errorFinishing')}</h1>
          <p className="mt-2 text-sm text-app-secondary">
            {t('geoChallenges.finishRetryDesc')}
          </p>
          <Button onClick={() => void retryFinish()} disabled={isSubmitting} fullWidth size="lg" className="mt-4">
            {isSubmitting ? t('common.loading') : t('geoChallenges.finishRetry')}
          </Button>
        </main>
      </div>
    );
  }

  if (status === 'finished' && finishResult) {
    const percentage = Math.round((finishResult.correctCount / finishResult.totalRounds) * 100);
    const resultSymbols = finishResult.details.map((detail) => detail.isCorrect ? '🟩' : '🟥').join('');
    const emoji = percentage === 100 ? '🏆' : percentage >= 60 ? '🎉' : '🧭';
    const performanceKey = percentage === 100 ? 'perfect' : percentage >= 60 ? 'strong' : 'explorer';
    const coveredRegions = new Set(game?.rounds.map((r) => r.region) ?? []);
    const uniqueRegionList = [...coveredRegions] as GeoChallengeRegion[];
    return (
      <div className="flex h-full min-h-0 overflow-y-auto bg-[var(--color-bg-app)] px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <main className="m-auto flex w-full max-w-md flex-col items-center text-center">
          <div className="text-6xl" aria-hidden="true">{emoji}</div>
          <h1 className="mt-3 text-2xl font-black text-app-text">{t('geoChallenges.complete')}</h1>
          <p className="mt-1 text-sm text-app-secondary">{t(`geoChallenges.performance.${performanceKey}`)}</p>

          <div className="mt-6 w-full rounded-3xl border border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-500/15 to-indigo-500/10 p-5 shadow-xl">
            <div className="text-5xl font-black tabular-nums text-app-text">
              {finishResult.correctCount}/{finishResult.totalRounds}
            </div>
            <div className="mt-2 text-2xl tracking-widest" aria-label={t('geoChallenges.resultPattern')}>
              {resultSymbols}
            </div>
            <p className="mt-3 text-sm font-semibold text-fuchsia-300">
              {t('geoChallenges.score', { score: finishResult.totalScore })}
            </p>
          </div>

          <section className="mt-4 w-full rounded-2xl border border-app-border bg-app-surface p-3 text-left">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black text-app-text">{t('geoChallenges.passportComplete')}</h2>
              <span className="text-xs font-bold text-emerald-300">{uniqueRegionList.length}/5 ✓</span>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {uniqueRegionList.map((region) => (
                <div key={region} className="min-w-0 rounded-xl bg-app-muted px-1 py-2 text-center">
                  <div className="text-xl" aria-hidden="true">{REGION_ICONS[region]}</div>
                  <div className="mt-1 truncate text-[0.56rem] font-bold text-app-subtle">
                    {t(`geoChallenges.regions.${region}`)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-3 w-full text-left">
            <h2 className="px-1 text-sm font-black text-app-text">{t('geoChallenges.roundRecap')}</h2>
            <div className="mt-2 space-y-2">
              {answers.map((answer, index) => (
                <details key={answer.roundId} className="group rounded-2xl border border-app-border bg-app-surface p-3">
                  <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${answer.isCorrect ? 'bg-green-500/15' : 'bg-red-500/15'}`} aria-hidden="true">
                      {answer.isCorrect ? '✓' : '✕'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-app-text">
                        {index + 1}. {KIND_ICONS[answer.kind]} {t(`geoChallenges.kinds.${answer.kind}`)}
                      </p>
                      <p className="text-[0.68rem] text-app-subtle">
                        {REGION_ICONS[answer.region]} {t(`geoChallenges.regions.${answer.region}`)} · {answer.points} pts
                      </p>
                    </div>
                    <span className="text-xs text-app-subtle transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
                  </summary>
                  <p className="mt-2 border-t border-app-border pt-2 text-xs leading-relaxed text-app-secondary">
                    {localizeGeoText(answer.explanation, i18n.language)}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <div className="mt-6 w-full">
            <ShareButton
              payload={{
                title: t('geoChallenges.title'),
                text: `${t('geoChallenges.shareText', { correct: finishResult.correctCount, total: finishResult.totalRounds })}\n${resultSymbols}`,
                url: window.location.href,
              }}
              label={t('geoChallenges.share')}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button onClick={() => void loadGame()} variant="primary" fullWidth>
                {t('geoChallenges.playAgain')}
              </Button>
              <Button onClick={() => navigate('/menu')} variant="secondary" fullWidth>
                {t('common.backToMenu')}
              </Button>
            </div>
          </div>
          <p className="mt-5 text-[0.68rem] text-app-subtle">
            {t('geoChallenges.dataNote', { date: game?.dataUpdatedAt })}
          </p>
        </main>
      </div>
    );
  }

  if (!game || !currentRound) return null;

  const prompt = localizeGeoText(currentRound.prompt, i18n.language);
  const instruction = localizeGeoText(currentRound.instruction, i18n.language);
  const selectedPosition = (optionId: string) => selectedOptionIds.indexOf(optionId) + 1;

  return (
    <>
      {confirmDialog}
      <a href="#geo-challenge-options" className="skip-link">{t('common.skipToAnswerOptions')}</a>
      <UniversalGameLayout
        className="geo-challenges-layout"
        header={
          <header className="border-b border-app-border bg-app-surface/90 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.6rem)] backdrop-blur sm:px-4">
            <div className="mx-auto grid max-w-4xl grid-cols-[auto_1fr_auto] items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (await confirm(t('game.confirmExit'))) { abandonTrackedRef.current = true; trackUxEvent('game_abandoned', { mode: 'single', variant: 'GEO_CHALLENGE', roundIndex, reason: 'navigation' }); navigate('/menu'); }
                }}
                className="pressable min-h-10 rounded-xl border border-app-border bg-app-muted px-3 text-xs font-semibold text-app-secondary hover:text-app-text"
                aria-label={t('game.exit')}
              >
                ✕ {t('game.exit')}
              </button>
              <div className="min-w-0 text-center">
                <div className="truncate text-sm font-black text-app-text">🧠 {t('geoChallenges.title')}</div>
                <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-fuchsia-400">
                  {KIND_ICONS[currentRound.kind]} {t(`geoChallenges.kinds.${currentRound.kind}`)}
                </div>
              </div>
              <Timer
                key={currentRound.id}
                duration={game.timePerRound}
                timeRemaining={timeRemaining}
                onTick={setTimeRemaining}
                onComplete={handleTimeComplete}
                isActive={!feedback && !isSubmitting}
              />
            </div>
          </header>
        }
        progress={
          <ProgressBar
            current={roundIndex + 1}
            total={game.rounds.length}
            results={resultsForProgress}
            showCurrentResult={Boolean(feedback)}
          />
        }
        content={
          <main className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col px-3 py-3 sm:px-4 sm:py-5">
            <section className="shrink-0 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/10 to-indigo-500/5 p-4 text-center sm:p-5">
              <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
                <span className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1 text-[0.65rem] font-bold text-indigo-200">
                  {REGION_ICONS[currentRound.region]} {t(`geoChallenges.regions.${currentRound.region}`)}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold ${DIFFICULTY_STYLES[currentRound.difficulty]}`}>
                  {t(`geoChallenges.difficulties.${currentRound.difficulty}`)}
                </span>
              </div>
              <div className="text-3xl" aria-hidden="true">{KIND_ICONS[currentRound.kind]}</div>
              <h1 className="mt-2 text-lg font-black leading-snug text-app-text sm:text-2xl">{prompt}</h1>
              <p className="mt-1 text-xs leading-snug text-app-subtle sm:text-sm">{instruction}</p>
            </section>

            <section id="geo-challenge-options" className="mt-3 min-h-0 flex-1 overflow-y-auto sm:mt-4">
              <div className={`grid gap-2 ${currentRound.options.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {currentRound.options.map((answerOption) => {
                  const position = selectedPosition(answerOption.id);
                  const isSelected = position > 0;
                  const isCorrectOption = feedback?.correctOptionIds.includes(answerOption.id);
                  const isWrongSelection = Boolean(feedback) && isSelected && !isCorrectOption;
                  const resultClass = feedback
                    ? isCorrectOption
                      ? 'border-green-500 bg-green-500/15 text-green-100'
                      : isWrongSelection
                        ? 'border-red-500 bg-red-500/15 text-red-100'
                        : 'border-app-border bg-app-surface/60 text-app-subtle opacity-65'
                    : isSelected
                      ? 'border-fuchsia-400 bg-fuchsia-500/20 text-app-text ring-1 ring-fuchsia-400/60'
                      : 'border-app-border bg-app-surface text-app-text hover:border-fuchsia-500/60 hover:bg-fuchsia-500/10';
                  return (
                    <button
                      key={answerOption.id}
                      type="button"
                      onClick={() => handleOptionClick(answerOption.id)}
                      disabled={Boolean(feedback) || isSubmitting}
                      aria-pressed={isSelected}
                      aria-label={isOrderedRound && isSelected
                        ? t('geoChallenges.selectedPosition', {
                            country: localizeGeoText(answerOption.label, i18n.language),
                            position,
                          })
                        : localizeGeoText(answerOption.label, i18n.language)}
                      className={`pressable relative flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-all sm:min-h-16 sm:text-base ${resultClass}`}
                    >
                      {isOrderedRound && isSelected && (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fuchsia-500 text-sm font-black text-white">
                          {position}
                        </span>
                      )}
                      <span className="text-2xl" aria-hidden="true">{flagFromIso2(answerOption.id)}</span>
                      <span className="min-w-0 flex-1">{localizeGeoText(answerOption.label, i18n.language)}</span>
                      {feedback && isCorrectOption && <span aria-hidden="true" className="text-green-400">✓</span>}
                      {isWrongSelection && <span aria-hidden="true" className="text-red-400">✕</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          </main>
        }
        footer={
          <footer className="border-t border-app-border bg-app-surface/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-2 backdrop-blur sm:px-4">
            <div className="mx-auto w-full max-w-4xl">
              {!feedback ? (
                <>
                  {roundError && <p className="mb-2 text-center text-xs text-red-300" role="alert">{roundError}</p>}
                  {isOrderedRound && selectedOptionIds.length > 0 && (
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs text-app-subtle">
                      <span>{t('geoChallenges.orderProgress', { current: selectedOptionIds.length, total: currentRound.options.length })}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedOptionIds((current) => current.slice(0, -1))}
                        className="rounded-lg px-2 py-1 font-semibold text-fuchsia-300 hover:bg-fuchsia-500/10"
                      >
                        ↶ {t('geoChallenges.undo')}
                      </button>
                    </div>
                  )}
                  <Button
                    onClick={() => void submitCurrentRound()}
                    disabled={!canSubmit || isSubmitting}
                    fullWidth
                    size="lg"
                  >
                    {isSubmitting ? t('common.loading') : t('geoChallenges.confirm')}
                  </Button>
                </>
              ) : (
                <div className="rounded-2xl border border-app-border bg-app-muted/90 p-2.5">
                  <div className="flex items-center justify-center gap-2 text-sm font-black">
                    <span className={feedback.isCorrect ? 'text-green-300' : 'text-red-300'}>
                      {feedback.isCorrect ? `✓ ${t('game.correct')}` : `✕ ${t('game.incorrect')}`}
                    </span>
                    {feedback.isCorrect && (
                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-black text-green-300">
                        +{feedback.points}
                      </span>
                    )}
                  </div>
                  {!feedback.isCorrect && (
                    <p className="mt-1 text-center text-xs text-app-secondary">
                      {isOrderedRound
                        ? `${t('geoChallenges.correctOrder')}: `
                        : `${t('geoChallenges.correctAnswer')}: `}
                      <span className="font-bold text-green-300">{correctAnswerLabel}</span>
                    </p>
                  )}
                  <p className="mt-1 text-center text-xs leading-snug text-app-subtle">
                    {localizeGeoText(feedback.explanation, i18n.language)}
                  </p>
                  <Button onClick={() => void handleNext()} disabled={isSubmitting} fullWidth className="mt-2">
                    {isLastRound ? t('geoChallenges.seeResults') : t('game.next')}
                  </Button>
                </div>
              )}
            </div>
          </footer>
        }
      />
    </>
  );
}
