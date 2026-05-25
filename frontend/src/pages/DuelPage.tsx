import { useEffect, useState, useCallback, lazy, Suspense, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useUiStore } from '../store/useUiStore';
import { socketService } from '../services/socket';
import {
  Timer,
  LoadingSpinner,
  GameRoundScaffold,
  RoundActionTray,
  MechanicsHud,
} from '../components';
import { UserAvatar } from '../components/atoms/UserAvatar';
import { Alert } from '../components/atoms/Alert';
import { Button } from '../components/atoms/Button';
import { MonumentAttribution } from '../components/MonumentAttribution';
import { Category, GameFilters, MechanicUsage, Question } from '../types';
import { GAME_CONSTANTS } from '../constants/game';
import { useHaptics, useImagePreloader } from '../hooks';
import { areMechanicsV2Enabled } from '../config/featureFlags';
import { trackUxEvent } from '../utils/uxTelemetry';

const MapInteractive = lazy(() =>
  import('../components/MapInteractive').then((m) => ({ default: m.MapInteractive }))
);

type DuelState = 'searching' | 'matched' | 'playing' | 'waiting' | 'finished';

interface DuelResult {
  winner: string | null;
  myScore: number;
  opponentScore: number;
  opponentName: string;
}

const { TIME_PER_QUESTION } = GAME_CONSTANTS;
const SEARCH_TIMEOUT_SECONDS = 120;
const DUEL_CATEGORIES: Category[] = ['FLAG', 'CAPITAL', 'MAP', 'SILHOUETTE', 'MONUMENT', 'CINEMA_GEO', 'MIXED'];

function parseDuelCategory(value: string | null): Category {
  if (!value) {
    return 'MIXED';
  }

  return DUEL_CATEGORIES.includes(value as Category) ? (value as Category) : 'MIXED';
}

export function DuelPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [duelState, setDuelState] = useState<DuelState>('searching');
  const [opponent, setOpponent] = useState<{ id: string; username: string } | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(TIME_PER_QUESTION);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [duelResult, setDuelResult] = useState<DuelResult | null>(null);
  const [searchTime, setSearchTime] = useState(0);
  const [connectionNotice, setConnectionNotice] = useState<{
    type: 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);
  const [showRetryAction, setShowRetryAction] = useState(false);
  const [isSyncingRound, setIsSyncingRound] = useState(false);
  const [searchTimedOut, setSearchTimedOut] = useState(false);
  const [disabledOptionIndexes, setDisabledOptionIndexes] = useState<number[]>([]);
  const [pendingMechanicUsage, setPendingMechanicUsage] = useState<MechanicUsage | undefined>(undefined);
  const [mechanicsEnabled, setMechanicsEnabled] = useState(false);
  const [mechanicsAllowed, setMechanicsAllowed] = useState<string[]>([]);
  const [mechanicsAvailable, setMechanicsAvailable] = useState({
    intel5050: 0,
    focusTime: 0,
    streakShield: 0,
  });
  const [hasSubmittedThisQuestion, setHasSubmittedThisQuestion] = useState(false);
  const [duelImageUrls, setDuelImageUrls] = useState<string[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreRef = useRef(0);
  const opponentRef = useRef<{ id: string; username: string } | null>(null);
  const duelStateRef = useRef<DuelState>('searching');
  const hasSubmittedCurrentQuestionRef = useRef(false);
  const duelMechanicsFeatureEnabled = areMechanicsV2Enabled('duel');
  const prefersReducedMotion = useUiStore((s) => s.prefersReducedMotion);
  const duelCategory = parseDuelCategory(searchParams.get('category'));
  const hasSelection = Boolean(selectedAnswer || mapLocation);
  useImagePreloader(duelImageUrls, 0); // skip=0: aún no hay ninguna imagen mostrándose

  const duelFilters = useMemo<GameFilters>(() => {
    const f: GameFilters = {};
    const continent = searchParams.get('continent');
    const difficulty = searchParams.get('difficulty');
    if (continent) f.continent = continent;
    if (searchParams.get('isInsular') === 'true') f.isInsular = true;
    if (searchParams.get('isLandlocked') === 'true') f.isLandlocked = true;
    if (difficulty === 'EASY' || difficulty === 'MEDIUM' || difficulty === 'HARD') f.difficulty = difficulty;
    return f;
  }, [searchParams]);
  const haptics = useHaptics();

  useEffect(() => {
    scoreRef.current = myScore;
  }, [myScore]);

  useEffect(() => {
    opponentRef.current = opponent;
  }, [opponent]);

  useEffect(() => {
    duelStateRef.current = duelState;
  }, [duelState]);

  const showConnectionMessage = useCallback((type: 'error' | 'warning' | 'info', message: string, retry = false) => {
    setConnectionNotice({ type, message });
    setShowRetryAction(retry);
  }, []);

  const retryDuelFlow = useCallback(() => {
    setConnectionNotice(null);
    setShowRetryAction(false);

    if (duelStateRef.current === 'searching') {
      socketService.joinDuelQueue(duelCategory, duelFilters);
      return;
    }

    if (duelStateRef.current === 'matched') {
      socketService.ready();
    }
  }, [duelCategory, duelFilters]);

  // Connect to socket and join queue
  useEffect(() => {
    socketService.connect();

    // Search timer
    const searchTimer = setInterval(() => {
      setSearchTime((prev) => prev + 1);
    }, 1000);

    // Search timeout — auto-cancel after SEARCH_TIMEOUT_SECONDS
    searchTimeoutRef.current = setTimeout(() => {
      socketService.cancelDuelQueue();
      clearInterval(searchTimer);
      setSearchTimedOut(true);
    }, SEARCH_TIMEOUT_SECONDS * 1000);

    // Event handlers
    const handleMatched = (data: any) => {
      if (data.opponent) {
        setOpponent(data.opponent);
      }
      if (duelMechanicsFeatureEnabled && data.mechanics?.enabled) {
        setMechanicsEnabled(true);
        setMechanicsAllowed(data.mechanics.allowed ?? []);
        setMechanicsAvailable({
          intel5050: data.mechanics.limits?.intel5050 ?? 1,
          focusTime: data.mechanics.limits?.focusTime ?? 1,
          streakShield: 0,
        });
      } else {
        setMechanicsEnabled(false);
        setMechanicsAllowed([]);
        setMechanicsAvailable({
          intel5050: 0,
          focusTime: 0,
          streakShield: 0,
        });
      }
      if (data.imageUrls?.length) {
        setDuelImageUrls(data.imageUrls);
      }
      setDuelState('matched');
      clearInterval(searchTimer);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      // Espera a que el backend emita countdown/start/question.
    };

    const handleOpponent = (data: any) => {
      setOpponent(data);
    };

    const handleQuestion = (data: any) => {
      setCurrentQuestion(data.question);
      setQuestionNumber((data.questionIndex ?? 0) + 1);
      setTotalQuestions(data.totalQuestions);
      setTimeRemaining(TIME_PER_QUESTION);
      setSelectedAnswer(null);
      setMapLocation(null);
      setShowResult(false);
      setIsSyncingRound(false);
      setDisabledOptionIndexes([]);
      setPendingMechanicUsage(undefined);
      hasSubmittedCurrentQuestionRef.current = false;
      setHasSubmittedThisQuestion(false);
      setConnectionNotice(null);
      setShowRetryAction(false);
      setDuelState('playing');
    };

    const handleAnswerResult = (data: any) => {
      const myResult = data.results?.find((result: any) => result.userId === user?.id);
      const rivalResult = data.results?.find((result: any) => result.userId !== user?.id);

      setShowResult(true);
      setIsSyncingRound(false);
      hasSubmittedCurrentQuestionRef.current = true;
      const wasCorrect = Boolean(myResult?.answer?.isCorrect);
      setLastAnswerCorrect(wasCorrect);
      setMyScore(myResult?.totalScore ?? 0);
      setOpponentScore(rivalResult?.totalScore ?? 0);
      if (wasCorrect) {
        haptics.success();
      } else {
        haptics.error();
      }
    };

    const handleDuelFinished = (data: any) => {
      const myResult = data.results?.find((result: any) => result.userId === user?.id);
      const rivalResult = data.results?.find((result: any) => result.userId !== user?.id);
      const myFinalScore = myResult?.score ?? 0;
      const rivalFinalScore = rivalResult?.score ?? 0;

      setDuelResult({
        winner: data.winnerId,
        myScore: myFinalScore,
        opponentScore: rivalFinalScore,
        opponentName: rivalResult?.username || opponent?.username || 'Opponent',
      });
      setDuelState('finished');
      if (data.winnerId === user?.id) {
        haptics.celebrate();
      } else if (data.winnerId && data.winnerId !== user?.id) {
        haptics.error();
      }
    };

    const handleOpponentDisconnected = () => {
      setDuelResult({
        winner: user?.id || null,
        myScore: scoreRef.current,
        opponentScore: 0,
        opponentName: opponentRef.current?.username || 'Opponent',
      });
      setDuelState('finished');
    };

    const handleDuelError = (data: { message?: string }) => {
      showConnectionMessage('error', data?.message || t('duel.errorGeneric'), true);
    };

    const handleDisconnect = () => {
      showConnectionMessage('warning', t('duel.connectionLost'), false);
    };

    const handleConnect = () => {
      const currentState = duelStateRef.current;

      if (currentState === 'searching') {
        socketService.joinDuelQueue(duelCategory, duelFilters);
        showConnectionMessage('info', t('duel.reconnectedSearching'), false);
        return;
      }

      if (currentState === 'playing' || currentState === 'waiting') {
        setIsSyncingRound(true);
        showConnectionMessage('info', t('duel.reconnectedSyncing'), false);
      } else {
        showConnectionMessage('info', t('duel.reconnected'), false);
      }
    };

    // Register event listeners
    socketService.socket?.on('duel:matched', handleMatched);
    socketService.socket?.on('duel:opponent', handleOpponent);
    socketService.socket?.on('duel:question', handleQuestion);
    socketService.socket?.on('duel:questionResult', handleAnswerResult);
    socketService.socket?.on('duel:finished', handleDuelFinished);
    socketService.socket?.on('duel:opponent-disconnected', handleOpponentDisconnected);
    socketService.socket?.on('duel:error', handleDuelError);
    socketService.socket?.on('disconnect', handleDisconnect);
    socketService.socket?.on('connect', handleConnect);

    // Join matchmaking queue after listeners are active
    socketService.joinDuelQueue(duelCategory, duelFilters);

    return () => {
      clearInterval(searchTimer);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      const stateOnCleanup = duelStateRef.current;
      if (stateOnCleanup === 'matched' || stateOnCleanup === 'playing' || stateOnCleanup === 'waiting') {
        socketService.socket?.emit('duel:leave');
      } else if (stateOnCleanup === 'searching') {
        socketService.cancelDuelQueue();
      }
      socketService.socket?.off('duel:matched', handleMatched);
      socketService.socket?.off('duel:opponent', handleOpponent);
      socketService.socket?.off('duel:question', handleQuestion);
      socketService.socket?.off('duel:questionResult', handleAnswerResult);
      socketService.socket?.off('duel:finished', handleDuelFinished);
      socketService.socket?.off('duel:opponent-disconnected', handleOpponentDisconnected);
      socketService.socket?.off('duel:error', handleDuelError);
      socketService.socket?.off('disconnect', handleDisconnect);
      socketService.socket?.off('connect', handleConnect);
    };
  }, [duelCategory, showConnectionMessage, user?.id]);

  useEffect(() => {
    if (duelState === 'matched') {
      socketService.ready();
    }
  }, [duelState]);

  // Handle time complete
  const handleTimeComplete = useCallback(() => {
    if (duelState === 'playing' && !showResult) {
      handleSubmitAnswer();
    }
  }, [duelState, showResult]);

  // Submit answer — used for MAP confirm button and timer expiry (non-MAP: no-op if already auto-submitted)
  const handleSubmitAnswer = () => {
    if (!currentQuestion || showResult || isSyncingRound || hasSubmittedCurrentQuestionRef.current) return;

    if (currentQuestion.category === 'MAP') {
      const coordinates = mapLocation || undefined;
      const answer = mapLocation ? `${mapLocation.lat},${mapLocation.lng}` : '0,0';
      hasSubmittedCurrentQuestionRef.current = true;
      socketService.submitDuelAnswer(currentQuestion.id, answer, timeRemaining, coordinates, pendingMechanicUsage);
      setPendingMechanicUsage(undefined);
      setDuelState('waiting');
    } else {
      // Timer expiry path: user never clicked any option
      hasSubmittedCurrentQuestionRef.current = true;
      setHasSubmittedThisQuestion(true);
      socketService.submitDuelAnswer(currentQuestion.id, selectedAnswer || '', timeRemaining, undefined, pendingMechanicUsage);
      setPendingMechanicUsage(undefined);
    }
  };

  // Auto-submit on option selection (non-MAP). Called with the new option value directly
  // to avoid reading stale selectedAnswer state.
  const handleAutoSubmitAnswer = (option: string) => {
    if (!currentQuestion || showResult || isSyncingRound) return;
    hasSubmittedCurrentQuestionRef.current = true;
    setHasSubmittedThisQuestion(true);
    socketService.submitDuelAnswer(currentQuestion.id, option, timeRemaining, undefined, pendingMechanicUsage);
    setPendingMechanicUsage(undefined);
  };

  // Option selection handler: auto-submits for non-MAP, plain select for MAP
  const handleOptionSelectDuel = (option: string) => {
    if (showResult || isSyncingRound) return;
    setSelectedAnswer(option);
    if (currentQuestion?.category !== 'MAP' && option !== selectedAnswer) {
      handleAutoSubmitAnswer(option);
    }
  };

  const handleUseIntel5050 = () => {
    if (!currentQuestion || isMapQuestion || showResult || duelState !== 'playing') return;
    if (!mechanicsEnabled || !mechanicsAllowed.includes('intel5050') || mechanicsAvailable.intel5050 <= 0) return;

    const selectedIndex = selectedAnswer ? currentQuestion.options.indexOf(selectedAnswer) : -1;
    const incorrectIndexes = currentQuestion.options
      .map((option, index) => ({ option, index }))
      .filter(({ option, index }) => option !== currentQuestion.correctAnswer && index !== selectedIndex)
      .map(({ index }) => index);

    if (incorrectIndexes.length === 0) return;
    const removedIndexes = [...incorrectIndexes].sort(() => Math.random() - 0.5).slice(0, Math.min(2, incorrectIndexes.length));

    setDisabledOptionIndexes(removedIndexes);
    setMechanicsAvailable((prev) => ({
      ...prev,
      intel5050: Math.max(0, prev.intel5050 - 1),
    }));
    setPendingMechanicUsage({
      key: 'intel5050',
      action: 'trigger',
      questionId: currentQuestion.id,
      roundIndex: questionNumber - 1,
      value: removedIndexes.length,
    });
    trackUxEvent('mechanic_used', {
      mode: 'duel',
      questionId: currentQuestion.id,
      value: removedIndexes.length,
      meta: { key: 'intel5050' },
    });
    haptics.tap();
  };

  const handleUseFocusTime = () => {
    if (!mechanicsEnabled || !mechanicsAllowed.includes('focusTime') || mechanicsAvailable.focusTime <= 0) return;
    if (showResult || duelState !== 'playing') return;

    const bonusSeconds = 3;
    const nextTime = Math.min(TIME_PER_QUESTION + bonusSeconds, timeRemaining + bonusSeconds);
    setTimeRemaining(nextTime);
    setMechanicsAvailable((prev) => ({
      ...prev,
      focusTime: Math.max(0, prev.focusTime - 1),
    }));
    setPendingMechanicUsage({
      key: 'focusTime',
      action: 'trigger',
      questionId: currentQuestion?.id,
      roundIndex: questionNumber - 1,
      value: bonusSeconds,
    });
    trackUxEvent('mechanic_used', {
      mode: 'duel',
      questionId: currentQuestion?.id,
      value: bonusSeconds,
      meta: { key: 'focusTime' },
    });
    haptics.tap();
  };

  // Cancel search
  const handleCancelSearch = () => {
    socketService.cancelDuelQueue();
    navigate('/menu');
  };

  // Format search time
  const formatSearchTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const connectionBanner = connectionNotice ? (
    <Alert type={connectionNotice.type} className="mb-4 w-full max-w-sm text-left">
      <p className="font-medium">{connectionNotice.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {showRetryAction && (
          <button
            onClick={retryDuelFlow}
            className="rounded-md border border-app-border bg-app-muted px-3 py-1.5 text-xs font-semibold text-app-text hover:bg-app-surface"
          >
            {t('duel.retry')}
          </button>
        )}
        <button
          onClick={() => navigate('/menu')}
          className="rounded-md border border-app-border bg-app-muted px-3 py-1.5 text-xs font-semibold text-app-text hover:bg-app-surface"
        >
          {t('common.backToMenu')}
        </button>
      </div>
    </Alert>
  ) : null;

  // Searching state
  if (duelState === 'searching') {
    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex items-center justify-center px-4">
        <div className="text-center w-full max-w-sm animate-fade-in">
          <div className="relative inline-flex items-center justify-center mb-6">
            {!prefersReducedMotion && (
              <>
                <span className="absolute inline-flex h-24 w-24 rounded-full bg-primary/10 animate-ping" />
                <span className="absolute inline-flex h-16 w-16 rounded-full bg-primary/15 animate-ping [animation-delay:0.3s]" />
              </>
            )}
            <span className="relative text-6xl">⚔️</span>
          </div>

          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
            {t('duel.searching')}
          </h1>
          <p className="text-[var(--color-text-muted)] mb-5">{t('duel.waitingForOpponent')}</p>
          {connectionBanner}

          <div className="mb-4 tabular-nums text-3xl font-bold text-[var(--color-text-secondary)]">
            {formatSearchTime(searchTime)}
          </div>

          <div className="mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left text-sm">
            <p className="text-primary font-semibold mb-1">
              {t('duel.queueCategory', {
                category: t(
                  `categories.${
                    duelCategory === 'FLAG'
                      ? 'flags'
                      : duelCategory === 'CAPITAL'
                      ? 'capitals'
                      : duelCategory === 'MAP'
                      ? 'maps'
                      : duelCategory === 'SILHOUETTE'
                      ? 'silhouettes'
                      : duelCategory === 'MONUMENT'
                      ? 'monuments'
                      : duelCategory === 'CINEMA_GEO'
                      ? 'cinemaGeo'
                      : 'mixed'
                  }`
                ),
              })}
            </p>
            {(duelFilters.continent || duelFilters.isInsular || duelFilters.isLandlocked || duelFilters.difficulty) && (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {[
                  duelFilters.continent && t(`filters.continents.${duelFilters.continent.replace(' ', '_')}`),
                  duelFilters.isInsular && t('filters.insular'),
                  duelFilters.isLandlocked && t('filters.landlocked'),
                  duelFilters.difficulty && t(`filters.difficulties.${duelFilters.difficulty}`),
                ].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="text-[var(--color-text-secondary)] mt-1">{t('duel.averageWaitHint')}</p>
            <p className="text-[var(--color-text-muted)] mt-1">{t('duel.cancelHint')}</p>
          </div>

          {searchTimedOut && (
            <Alert type="warning" className="mb-4 w-full">
              <p className="font-medium">{t('duel.searchTimeout')}</p>
            </Alert>
          )}

          <Button
            onClick={handleCancelSearch}
            variant="secondary"
            size="lg"
          >
            {t('duel.cancel')}
          </Button>
        </div>
      </div>
    );
  }

  // Matched state
  if (duelState === 'matched' && opponent) {
    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex items-center justify-center px-4">
        <div className="text-center animate-scale-in">
          {connectionBanner}
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/80 mb-2">
            {t('duel.opponentFound')}
          </p>
          <h1 className="text-3xl font-black text-[var(--color-text-primary)] mb-8">
            {t('duel.matchFound', 'Rival encontrado')}
          </h1>
          <div className="flex items-center justify-center gap-6 mb-8">
            <div className="text-center">
              <div className="relative inline-block mb-2">
                <UserAvatar username={user?.username ?? ''} size="lg" className="ring-2 ring-primary/60" />
              </div>
              <p className="text-[var(--color-text-primary)] font-semibold text-sm">{user?.username}</p>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-[var(--color-text-muted)]">VS</span>
              <div className="h-px w-8 bg-[var(--color-border)]" />
            </div>

            <div className="text-center">
              <div className="relative inline-block mb-2">
                <UserAvatar username={opponent.username} size="lg" color="bg-red-500" className="ring-2 ring-red-400/60" />
              </div>
              <p className="text-[var(--color-text-primary)] font-semibold text-sm">{opponent.username}</p>
            </div>
          </div>
          <p className={`text-sm text-[var(--color-text-muted)] ${!prefersReducedMotion ? 'animate-pulse' : ''}`}>
            {t('duel.starting')}
          </p>
        </div>
      </div>
    );
  }

  // Finished state
  if (duelState === 'finished' && duelResult) {
    const isWinner = duelResult.winner === user?.id;
    const isTie = duelResult.myScore === duelResult.opponentScore;

    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex items-center justify-center px-4">
        <div className={`max-w-md w-full rounded-2xl border p-6 sm:p-8 text-center animate-scale-in ${
          isWinner
            ? 'border-yellow-500/40 bg-gradient-to-b from-yellow-950/40 to-[var(--color-surface)]'
            : isTie
              ? 'border-[var(--color-border)] bg-[var(--color-surface)]'
              : 'border-[var(--color-border)] bg-[var(--color-surface)]'
        }`}>
          {connectionBanner}

          <div className={`text-6xl mb-3 ${isWinner && !prefersReducedMotion ? 'animate-bounce' : ''}`}>
            {isTie ? '🤝' : isWinner ? '🏆' : '💪'}
          </div>

          <h1 className={`text-3xl font-black mb-1 ${isWinner ? 'text-yellow-400' : isTie ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-primary)]'}`}>
            {isTie ? t('duel.tie') : isWinner ? t('duel.youWin') : t('duel.youLose')}
          </h1>
          {!isTie && !isWinner && (
            <p className="text-sm text-[var(--color-text-muted)] mb-4">{t('duel.goodGame', '¡Buen juego! Intenta de nuevo.')}</p>
          )}

          <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="text-center">
              <div className={`text-3xl font-black ${isWinner ? 'text-yellow-400' : 'text-primary'}`}>
                {duelResult.myScore.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)] truncate max-w-full">{user?.username}</div>
            </div>
            <div className="text-sm font-bold text-[var(--color-text-muted)]">vs</div>
            <div className="text-center">
              <div className={`text-3xl font-black ${!isWinner && !isTie ? 'text-yellow-400' : 'text-red-400'}`}>
                {duelResult.opponentScore.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)] truncate max-w-full">{duelResult.opponentName}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Button
              onClick={() => {
                setDuelState('searching');
                setSearchTime(0);
                setSearchTimedOut(false);
                socketService.joinDuelQueue(duelCategory, duelFilters);
              }}
              variant="primary"
              size="lg"
              fullWidth
            >
              {t('duel.playAgain')}
            </Button>
            <Button
              onClick={() => navigate('/menu')}
              variant="secondary"
              size="lg"
              fullWidth
            >
              {t('common.backToMenu')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Playing state
  if (!currentQuestion) {
    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex flex-col items-center justify-center px-4">
        {connectionBanner}
        <LoadingSpinner size="lg" text={t('duel.loadingQuestion')} />
      </div>
    );
  }

  const isMapQuestion = currentQuestion.category === 'MAP';
  return (
    <GameRoundScaffold
      rootClassName="bg-[var(--color-bg-app)]"
      header={
        <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 pt-2 backdrop-blur sm:px-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserAvatar username={user?.username ?? ''} size="sm" />
              <span className="text-xl font-bold text-primary">{myScore}</span>
            </div>

            <Timer
              duration={TIME_PER_QUESTION}
              timeRemaining={timeRemaining}
              onTick={setTimeRemaining}
              onComplete={handleTimeComplete}
              isActive={duelState === 'playing' && !showResult}
            />

            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-red-400">{opponentScore}</span>
              <UserAvatar username={opponent?.username ?? ''} size="sm" color="bg-red-500" />
            </div>
          </div>
        </header>
      }
      progress={
        <div className="bg-app-muted/65 px-3 py-1.5 text-center sm:px-4">
          <span className="text-[var(--color-text-secondary)] text-sm">
            {t('game.questionOf', { current: questionNumber, total: totalQuestions })}
          </span>
          {isSyncingRound && (
            <p className="mt-1 text-xs text-sky-300">{t('duel.reconnectedSyncing')}</p>
          )}
        </div>
      }
      question={currentQuestion}
      questionNumber={questionNumber}
      totalQuestions={totalQuestions}
      isMapQuestion={isMapQuestion}
      mapContent={
        <Suspense fallback={<LoadingSpinner size="lg" />}>
          <MapInteractive
            questionId={currentQuestion.id}
            onLocationSelect={(lat, lng) => setMapLocation({ lat, lng })}
            selectedLocation={mapLocation}
            correctLocation={
              showResult && currentQuestion.latitude && currentQuestion.longitude
                ? { lat: currentQuestion.latitude, lng: currentQuestion.longitude }
                : null
            }
            showResult={showResult}
            disabled={showResult || duelState === 'waiting'}
          />
        </Suspense>
      }
      selectedAnswer={selectedAnswer}
      onOptionSelect={handleOptionSelectDuel}
      showResult={showResult}
      hiddenOptionIndexes={disabledOptionIndexes}
      disableOptions={showResult || isSyncingRound}
      optionsGridClassName="game-options-grid"
      actionTray={
        <RoundActionTray
          mode="duel"
          showResult={showResult}
          canSubmit={hasSelection && !isSyncingRound}
          isWaiting={isMapQuestion ? duelState === 'waiting' : hasSubmittedThisQuestion}
          autoSubmit={!isMapQuestion}
          submitLabel={t('game.submit')}
          selectionAssistiveText={t('game.selectionReadyShortHint')}
          waitingLabel={t('duel.waitingForOpponent')}
          resultLabel={lastAnswerCorrect ? t('game.correct') : t('game.incorrect')}
          resultAttribution={
            currentQuestion && currentQuestion.category === 'MONUMENT'
              ? <MonumentAttribution question={currentQuestion} />
              : undefined
          }
          showResultBadge
          isCorrect={lastAnswerCorrect}
          correctAnswer={showResult && !lastAnswerCorrect ? currentQuestion?.correctAnswer : undefined}
          onSubmit={handleSubmitAnswer}
          summarySlot={
            mechanicsEnabled ? (
              <MechanicsHud
                available={mechanicsAvailable}
                disabled={showResult || duelState !== 'playing'}
                onUseIntel5050={handleUseIntel5050}
                onUseFocusTime={handleUseFocusTime}
              />
            ) : undefined
          }
        />
      }
    />
  );
}
