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
  UniversalGameLayout,
} from '../components';
import { UserAvatar } from '../components/atoms/UserAvatar';
import { Alert } from '../components/atoms/Alert';
import { Button } from '../components/atoms/Button';
import { MonumentAttribution } from '../components/MonumentAttribution';
import {
  Category,
  DuelMode,
  GameFilters,
  GeoChallengeKind,
  GeoChallengeRegion,
  LocalizedText,
  MechanicUsage,
  Question,
} from '../types';
import { GAME_CONSTANTS } from '../constants/game';
import { useHaptics, useImagePreloader } from '../hooks';
import { areMechanicsV2Enabled } from '../config/featureFlags';
import { trackUxEvent } from '../utils/uxTelemetry';
import { getSocketErrorMessage } from '../utils/apiError';

const MapInteractive = lazy(() =>
  import('../components/MapInteractive').then((m) => ({ default: m.MapInteractive }))
);

type DuelState = 'searching' | 'matched' | 'playing' | 'waiting' | 'finished';

interface DuelResult {
  winner: string | null;
  myScore: number;
  opponentScore: number;
  opponentName: string;
  wonByForfeit?: boolean;
}

const { TIME_PER_QUESTION } = GAME_CONSTANTS;
const SEARCH_TIMEOUT_SECONDS = 120;
const SOCKET_CONNECT_TIMEOUT_MS = 10000;
const SYNCING_LONG_THRESHOLD_MS = 5000;
const DUEL_CATEGORIES: Category[] = ['FLAG', 'CAPITAL', 'MAP', 'SILHOUETTE', 'MONUMENT', 'CINEMA_GEO', 'MIXED'];

const GEO_KIND_ICONS: Record<GeoChallengeKind, string> = {
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

const GEO_REGION_ICONS: Record<GeoChallengeRegion, string> = {
  AFRICA: '🌍',
  AMERICAS: '🌎',
  ASIA: '🌏',
  EUROPE: '🧭',
  OCEANIA: '🏝️',
};

function localizeGeoText(text: LocalizedText, language: string): string {
  return language.startsWith('en') ? text.en : text.es;
}

function flagFromIso2(iso2: string): string {
  return iso2.toUpperCase().split('')
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join('');
}

function parseDuelCategory(value: string | null): Category {
  if (!value) {
    return 'MIXED';
  }

  return DUEL_CATEGORIES.includes(value as Category) ? (value as Category) : 'MIXED';
}

export function DuelPage() {
  const { t, i18n } = useTranslation();
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
  const [questionTimeLimit, setQuestionTimeLimit] = useState(TIME_PER_QUESTION);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [geoSelectionIds, setGeoSelectionIds] = useState<string[]>([]);
  const [geoFeedback, setGeoFeedback] = useState<{
    correctOptionIds: string[];
    explanation: LocalizedText;
  } | null>(null);
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [resultCorrectAnswer, setResultCorrectAnswer] = useState<string | undefined>(undefined);
  const [resultCorrectLocation, setResultCorrectLocation] = useState<{ lat: number; lng: number } | null>(null);
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
  // Part 1.1: reassurance cuando isSyncingRound se alarga + timeout de conexión inicial.
  const [showSyncingLongHint, setShowSyncingLongHint] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingLongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreRef = useRef(0);
  const opponentRef = useRef<{ id: string; username: string } | null>(null);
  const duelStateRef = useRef<DuelState>('searching');
  const hasSubmittedCurrentQuestionRef = useRef(false);
  const abandonTrackedRef = useRef(false);
  const duelMechanicsFeatureEnabled = areMechanicsV2Enabled('duel');
  const prefersReducedMotion = useUiStore((s) => s.prefersReducedMotion);
  const duelCategory = parseDuelCategory(searchParams.get('category'));
  const duelMode: DuelMode = searchParams.get('mode') === 'geo-challenge' ? 'geo-challenge' : 'classic';
  const geoRound = currentQuestion?.geoChallenge;
  const isGeoDuel = duelMode === 'geo-challenge';
  const hasCompleteGeoSelection = geoRound ? (
    geoRound.selectionMode === 'ordered'
      ? geoSelectionIds.length === geoRound.options.length
      : geoSelectionIds.length === 1
  ) : false;
  const hasSelection = isGeoDuel ? hasCompleteGeoSelection : Boolean(selectedAnswer || mapLocation);
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
      socketService.joinDuelQueue(duelCategory, duelFilters, duelMode);
      return;
    }

    if (duelStateRef.current === 'matched') {
      socketService.ready();
    }
  }, [duelCategory, duelFilters, duelMode]);

  // Part 1.1: pub-sub de socketService — si el estado pasa a 'error' mientras
  // estamos buscando/emparejados/jugando, mostramos el banner con Reintentar.
  // Antes connect_error solo hacía console.error y el usuario se quedaba
  // viendo "Buscando rival..." para siempre sin ninguna explicación.
  useEffect(() => {
    const unsubscribe = socketService.onConnectionStateChange((newState) => {
      if (newState === 'error' && duelStateRef.current !== 'finished') {
        showConnectionMessage('error', t('duel.connectionErrorNotice'), true);
      }
    });
    return unsubscribe;
  }, [showConnectionMessage, t]);

  // Timeout de conexión inicial: si a los 10s el socket no llegó a 'connected',
  // no dejamos al usuario esperando indefinidamente sin explicación.
  useEffect(() => {
    connectTimeoutRef.current = setTimeout(() => {
      if (socketService.isConnected()) return;
      if (duelStateRef.current === 'finished') return;
      showConnectionMessage('error', t('duel.connectionErrorNotice'), true);
    }, SOCKET_CONNECT_TIMEOUT_MS);
    return () => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si isSyncingRound se alarga más de ~5s, texto tranquilizador extra —
  // sincronizar una ronda de duelo no debería sentirse como progreso perdido.
  useEffect(() => {
    if (!isSyncingRound) {
      setShowSyncingLongHint(false);
      if (syncingLongTimeoutRef.current) {
        clearTimeout(syncingLongTimeoutRef.current);
        syncingLongTimeoutRef.current = null;
      }
      return;
    }
    syncingLongTimeoutRef.current = setTimeout(() => {
      setShowSyncingLongHint(true);
    }, SYNCING_LONG_THRESHOLD_MS);
    return () => {
      if (syncingLongTimeoutRef.current) clearTimeout(syncingLongTimeoutRef.current);
    };
  }, [isSyncingRound]);

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
      if (typeof data.timePerQuestion === 'number') {
        setQuestionTimeLimit(data.timePerQuestion);
      }
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
      const nextTimeLimit = typeof data.timeLimit === 'number' ? data.timeLimit : TIME_PER_QUESTION;
      setQuestionTimeLimit(nextTimeLimit);
      setTimeRemaining(nextTimeLimit);
      setSelectedAnswer(null);
      setGeoSelectionIds([]);
      setGeoFeedback(null);
      setMapLocation(null);
      setShowResult(false);
      setIsSyncingRound(false);
      setDisabledOptionIndexes([]);
      setPendingMechanicUsage(undefined);
      setResultCorrectAnswer(undefined);
      setResultCorrectLocation(null);
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
      setGeoFeedback(data.geoChallenge ?? null);
      setLastAnswerCorrect(wasCorrect);
      setMyScore(myResult?.totalScore ?? 0);
      setOpponentScore(rivalResult?.totalScore ?? 0);
      setResultCorrectAnswer(data.correctAnswer ?? undefined);
      setResultCorrectLocation(data.correctLocation ?? null);
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
        opponentName: rivalResult?.username || opponent?.username || t('duel.opponent'),
      });
      setDuelState('finished');
      abandonTrackedRef.current = true;
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
        opponentName: opponentRef.current?.username || t('duel.opponent'),
        wonByForfeit: true,
      });
      setDuelState('finished');
      abandonTrackedRef.current = true;
    };

    const handleDuelError = (data: { message?: string; code?: string; params?: Record<string, unknown> }) => {
      showConnectionMessage('error', getSocketErrorMessage(data, t('duel.errorGeneric')), true);
    };

    const handleDisconnect = () => {
      showConnectionMessage('warning', t('duel.connectionLost'), false);
    };

    const handleConnect = () => {
      const currentState = duelStateRef.current;

      if (currentState === 'searching') {
        socketService.joinDuelQueue(duelCategory, duelFilters, duelMode);
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
    socketService.joinDuelQueue(duelCategory, duelFilters, duelMode);

    return () => {
      clearInterval(searchTimer);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      const stateOnCleanup = duelStateRef.current;
      if (stateOnCleanup === 'matched' || stateOnCleanup === 'playing' || stateOnCleanup === 'waiting') {
        if (!abandonTrackedRef.current) {
          abandonTrackedRef.current = true;
          trackUxEvent('game_abandoned', {
            mode: 'duel',
            reason: 'navigation',
            duelState: stateOnCleanup,
          });
        }
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
  }, [duelCategory, duelMode, showConnectionMessage, user?.id]);

  useEffect(() => {
    if (duelState === 'matched') {
      socketService.ready();
    }
  }, [duelState]);

  // Handle time complete
  const handleTimeComplete = () => {
    if (duelState === 'playing' && !showResult) {
      handleSubmitAnswer();
    }
  };

  // Submit answer — used for MAP confirm button and timer expiry (non-MAP: no-op if already auto-submitted)
  const handleSubmitAnswer = () => {
    if (!currentQuestion || showResult || isSyncingRound || hasSubmittedCurrentQuestionRef.current) return;

    if (isGeoDuel) {
      hasSubmittedCurrentQuestionRef.current = true;
      setHasSubmittedThisQuestion(true);
      socketService.submitDuelAnswer(
        currentQuestion.id,
        geoSelectionIds.join(','),
        timeRemaining,
      );
      setDuelState('waiting');
    } else if (currentQuestion.category === 'MAP') {
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
    if (isGeoDuel && geoRound) {
      setGeoSelectionIds((current) => geoRound.selectionMode === 'ordered'
        ? current.includes(option)
          ? current.filter((optionId) => optionId !== option)
          : [...current, option]
        : [option]);
      return;
    }
    setSelectedAnswer(option);
    if (currentQuestion?.category !== 'MAP' && option !== selectedAnswer) {
      handleAutoSubmitAnswer(option);
    }
  };

  const handleUseIntel5050 = () => {
    // Disabled until server-authoritative mechanic support is available.
    // Cannot determine incorrect options without access to correctAnswer from the question payload.
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
      {showRetryAction && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={retryDuelFlow}
            className="rounded-md border border-app-border bg-app-muted px-3 py-1.5 text-xs font-semibold text-app-text hover:bg-app-surface"
          >
            {t('duel.retry')}
          </button>
        </div>
      )}
      {/* "Back to menu" eliminado: cada estado (searching/matched/playing) ya
          tiene su propio Cancel/Exit. Tener dos acciones de cancelar (una
          dentro del banner azul y otra abajo como Cancel) generaba dudas en
          QA round 2 ROUND2-004. */}
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

          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-5">
            {t('duel.searching')}
          </h1>
          {/* QA fix LO-1: antes había dos frases redundantes ("Buscando
              oponente..." + "Esperando al oponente..."). Dejamos sólo el
              título; el contador de tiempo ya señala que está activo. */}
          {connectionBanner}

          <div className="mb-4 tabular-nums text-3xl font-bold text-[var(--color-text-secondary)]">
            {formatSearchTime(searchTime)}
          </div>

          <div className="mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left text-sm">
            <p className="text-primary font-semibold mb-1">
              {isGeoDuel
                ? t('duel.geoQueue')
                : t('duel.queueCategory', {
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
            {!isGeoDuel && (duelFilters.continent || duelFilters.isInsular || duelFilters.isLandlocked || duelFilters.difficulty) && (
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
            <p className="text-primary/80 mt-1 text-xs">{t('duel.expectedWait')}</p>
            <p className="text-[var(--color-text-muted)] mt-1">{t('duel.cancelHint')}</p>
          </div>

          {searchTimedOut && (
            <div className="mb-4 w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-left">
              <p className="font-medium text-amber-700 dark:text-amber-300">{t('duel.searchTimeoutWarm')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => navigate('/menu')} variant="secondary" size="sm">
                  {t('duel.changeCategory')}
                </Button>
                <Button
                  onClick={() => {
                    setSearchTimedOut(false);
                    setSearchTime(0);
                    socketService.joinDuelQueue(duelCategory, duelFilters, duelMode);
                  }}
                  variant="primary"
                  size="sm"
                >
                  {t('duel.retry')}
                </Button>
              </div>
            </div>
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
    const pointDiff = Math.abs(duelResult.myScore - duelResult.opponentScore);
    // Part 5.1: ninguna pantalla de derrota lidera con una palabra fría — la
    // palabra "Perdiste" sigue visible (el hecho no se esconde) pero solo como
    // texto secundario junto al score; el titular es contextual y ofrece
    // una acción concreta (Revancha).
    const isCloseLoss = !isWinner && !isTie && pointDiff <= 200;

    const rematch = () => {
      setDuelState('searching');
      setSearchTime(0);
      setSearchTimedOut(false);
      socketService.joinDuelQueue(duelCategory, duelFilters, duelMode);
    };

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
            {isTie ? '🤝' : isWinner ? '🏆' : isCloseLoss ? '🔥' : '💪'}
          </div>

          <h1 className={`text-3xl font-black mb-1 ${isWinner ? 'text-yellow-400' : isTie ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-primary)]'}`}>
            {isTie
              ? t('duel.tie')
              : isWinner
                ? t('duel.youWin')
                : isCloseLoss
                  ? t('duel.almostWon', { diff: pointDiff })
                  : t('duel.rematchNudge', { opponent: duelResult.opponentName })}
          </h1>
          {!isTie && !isWinner && (
            <p className="text-sm text-[var(--color-text-muted)] mb-4">{t('duel.youLose')}</p>
          )}
          {isWinner && duelResult.wonByForfeit && (
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              {t('duel.wonByForfeit', { opponent: duelResult.opponentName })}
            </p>
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
              onClick={rematch}
              variant="primary"
              size="lg"
              fullWidth
            >
              {isWinner || isTie ? t('duel.playAgain') : t('duel.rematch')}
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
  if (isGeoDuel && geoRound) {
    const correctAnswer = geoFeedback?.correctOptionIds
      .map((optionId) => geoRound.options.find((option) => option.id === optionId))
      .filter((option): option is NonNullable<typeof option> => Boolean(option))
      .map((option) => localizeGeoText(option.label, i18n.language))
      .join(' → ');

    return (
      <UniversalGameLayout
        className="bg-[var(--color-bg-app)]"
        header={
          <header className="border-b border-app-border bg-app-surface/95 px-3 py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur sm:px-4">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar username={user?.username ?? ''} size="sm" />
                <span className="text-xl font-black text-primary">{myScore}</span>
              </div>
              <Timer
                key={currentQuestion.id}
                duration={questionTimeLimit}
                timeRemaining={timeRemaining}
                onTick={setTimeRemaining}
                onComplete={handleTimeComplete}
                isActive={duelState === 'playing' && !showResult}
              />
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-xl font-black text-red-400">{opponentScore}</span>
                <UserAvatar username={opponent?.username ?? ''} size="sm" color="bg-red-500" />
              </div>
            </div>
          </header>
        }
        progress={
          <div className="bg-app-muted/65 px-3 py-1.5 text-center">
            <span className="text-sm text-app-secondary">
              {t('game.questionOf', { current: questionNumber, total: totalQuestions })}
            </span>
            <span className="ml-2 text-xs font-bold text-fuchsia-300">
              {GEO_REGION_ICONS[geoRound.region]} {t(`geoChallenges.regions.${geoRound.region}`)}
            </span>
          </div>
        }
        content={
          <main className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col px-3 py-3 sm:px-4">
            <section className="shrink-0 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/10 to-indigo-500/5 p-3 text-center sm:p-4">
              <div className="text-2xl" aria-hidden="true">{GEO_KIND_ICONS[geoRound.kind]}</div>
              <h1 className="mt-1 text-base font-black leading-snug text-app-text sm:text-xl">
                {localizeGeoText(geoRound.prompt, i18n.language)}
              </h1>
              <p className="mt-1 text-xs text-app-subtle">
                {localizeGeoText(geoRound.instruction, i18n.language)}
              </p>
            </section>

            <section id="game-options" className="mt-3 min-h-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {geoRound.options.map((option) => {
                  const position = geoSelectionIds.indexOf(option.id) + 1;
                  const isSelected = position > 0;
                  const isCorrectOption = Boolean(geoFeedback?.correctOptionIds.includes(option.id));
                  const isWrongSelection = showResult && isSelected && !isCorrectOption;
                  const stateClass = showResult
                    ? isCorrectOption
                      ? 'border-green-500 bg-green-500/15 text-green-100'
                      : isWrongSelection
                        ? 'border-red-500 bg-red-500/15 text-red-100'
                        : 'border-app-border bg-app-surface/60 text-app-subtle opacity-65'
                    : isSelected
                      ? 'border-fuchsia-400 bg-fuchsia-500/20 text-app-text ring-1 ring-fuchsia-400/60'
                      : 'border-app-border bg-app-surface text-app-text hover:border-fuchsia-500/60';

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleOptionSelectDuel(option.id)}
                      disabled={showResult || isSyncingRound || hasSubmittedThisQuestion}
                      aria-pressed={isSelected}
                      className={`pressable flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-all ${stateClass}`}
                    >
                      {geoRound.selectionMode === 'ordered' && isSelected && (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fuchsia-500 text-sm font-black text-white">
                          {position}
                        </span>
                      )}
                      <span className="text-2xl" aria-hidden="true">{flagFromIso2(option.id)}</span>
                      <span className="min-w-0 flex-1">{localizeGeoText(option.label, i18n.language)}</span>
                      {showResult && isCorrectOption && <span className="text-green-400" aria-hidden="true">✓</span>}
                      {isWrongSelection && <span className="text-red-400" aria-hidden="true">✕</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          </main>
        }
        footer={
          <RoundActionTray
            mode="duel"
            showResult={showResult}
            canSubmit={hasCompleteGeoSelection && !isSyncingRound}
            isWaiting={hasSubmittedThisQuestion && !showResult}
            autoSubmit={false}
            submitLabel={t('geoChallenges.confirm')}
            waitingLabel={t('duel.waitingForOpponent')}
            resultLabel={lastAnswerCorrect ? t('game.correct') : t('game.incorrect')}
            showResultBadge
            isCorrect={lastAnswerCorrect}
            correctAnswer={!lastAnswerCorrect ? correctAnswer : undefined}
            resultHint={geoFeedback ? localizeGeoText(geoFeedback.explanation, i18n.language) : undefined}
            onSubmit={handleSubmitAnswer}
            summarySlot={geoRound.selectionMode === 'ordered' && !showResult && !hasSubmittedThisQuestion ? (
              <div className="flex items-center justify-between gap-2 px-2 text-xs text-app-subtle sm:min-w-56">
                <span>{t('geoChallenges.orderProgress', { current: geoSelectionIds.length, total: geoRound.options.length })}</span>
                {geoSelectionIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGeoSelectionIds((current) => current.slice(0, -1))}
                    className="rounded-lg px-2 py-1 font-semibold text-fuchsia-300 hover:bg-fuchsia-500/10"
                  >
                    ↶ {t('geoChallenges.undo')}
                  </button>
                )}
              </div>
            ) : undefined}
          />
        }
      />
    );
  }

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
              duration={questionTimeLimit}
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
            <p className="mt-1 text-xs text-sky-300">
              {showSyncingLongHint ? t('duel.syncingLong') : t('duel.reconnectedSyncing')}
            </p>
          )}
          {/* Solo el banner de error (con Reintentar) se repite acá — los avisos
              info/warning (reconectando, sincronizando) ya tienen su propio texto
              inline arriba; duplicarlos se sentía redundante (mismo string 2x). */}
          {connectionNotice?.type === 'error' && (
            <div className="mt-2">{connectionBanner}</div>
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
            correctLocation={showResult ? resultCorrectLocation : null}
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
          correctAnswer={showResult && !lastAnswerCorrect ? resultCorrectAnswer : undefined}
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
