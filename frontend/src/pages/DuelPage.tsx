import { useEffect, useState, useCallback, lazy, Suspense, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socket';
import {
  Timer,
  LoadingSpinner,
  GameRoundScaffold,
  RoundActionTray,
} from '../components';
import { UserAvatar } from '../components/atoms/UserAvatar';
import { Alert } from '../components/atoms/Alert';
import { Button } from '../components/atoms/Button';
import { Category, Question } from '../types';
import { GAME_CONSTANTS } from '../constants/game';

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
const DUEL_CATEGORIES: Category[] = ['FLAG', 'CAPITAL', 'MAP', 'SILHOUETTE', 'MIXED'];

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
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreRef = useRef(0);
  const opponentRef = useRef<{ id: string; username: string } | null>(null);
  const duelStateRef = useRef<DuelState>('searching');
  const hasSubmittedCurrentQuestionRef = useRef(false);
  const duelCategory = parseDuelCategory(searchParams.get('category'));
  const hasSelection = Boolean(selectedAnswer || mapLocation);

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
      socketService.joinDuelQueue(duelCategory);
      return;
    }

    if (duelStateRef.current === 'matched') {
      socketService.ready();
    }
  }, [duelCategory]);

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
      hasSubmittedCurrentQuestionRef.current = false;
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
      setLastAnswerCorrect(Boolean(myResult?.answer?.isCorrect));
      setMyScore(myResult?.totalScore ?? 0);
      setOpponentScore(rivalResult?.totalScore ?? 0);
    };

    const handleDuelFinished = (data: any) => {
      const myResult = data.results?.find((result: any) => result.userId === user?.id);
      const rivalResult = data.results?.find((result: any) => result.userId !== user?.id);

      setDuelResult({
        winner: data.winnerId,
        myScore: myResult?.score ?? 0,
        opponentScore: rivalResult?.score ?? 0,
        opponentName: rivalResult?.username || opponent?.username || 'Opponent',
      });
      setDuelState('finished');
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
        socketService.joinDuelQueue(duelCategory);
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
    socketService.joinDuelQueue(duelCategory);

    return () => {
      clearInterval(searchTimer);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      socketService.cancelDuelQueue();
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

  // Submit answer
  const handleSubmitAnswer = () => {
    if (!currentQuestion || showResult || isSyncingRound || hasSubmittedCurrentQuestionRef.current) return;

    const isMapQuestion = currentQuestion.category === 'MAP';
    let answer: string;
    let coordinates: { lat: number; lng: number } | undefined;

    if (isMapQuestion) {
      coordinates = mapLocation || undefined;
      answer = mapLocation ? `${mapLocation.lat},${mapLocation.lng}` : '0,0';
    } else {
      answer = selectedAnswer || '';
    }

    hasSubmittedCurrentQuestionRef.current = true;
    socketService.submitDuelAnswer(currentQuestion.id, answer, timeRemaining, coordinates);
    setDuelState('waiting');
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
            className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
          >
            {t('duel.retry')}
          </button>
        )}
        <button
          onClick={() => navigate('/menu')}
          className="rounded-md bg-black/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/30"
        >
          {t('common.backToMenu')}
        </button>
      </div>
    </Alert>
  ) : null;

  // Searching state
  if (duelState === 'searching') {
    return (
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center w-full max-w-sm">
          <div className="text-6xl mb-6 animate-pulse">⚔️</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {t('duel.searching')}
          </h1>
          <p className="text-gray-400 mb-6">{t('duel.waitingForOpponent')}</p>
          {connectionBanner}
          <div className="mb-6">
            <LoadingSpinner size="lg" />
          </div>
          <p className="text-gray-500 mb-3">{formatSearchTime(searchTime)}</p>

          <div className="mb-6 rounded-xl border border-gray-700 bg-gray-800/80 px-4 py-3 text-left text-sm">
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
                      : 'mixed'
                  }`
                ),
              })}
            </p>
            <p className="text-gray-300">{t('duel.averageWaitHint')}</p>
            <p className="text-gray-400 mt-1">{t('duel.cancelHint')}</p>
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
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          {connectionBanner}
          <h1 className="text-2xl font-bold text-white mb-8">
            {t('duel.opponentFound')}
          </h1>
          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="text-center">
              <UserAvatar username={user?.username ?? ''} size="lg" className="mb-2" />
              <p className="text-white font-semibold">{user?.username}</p>
            </div>
            <div className="text-4xl animate-pulse">⚔️</div>
            <div className="text-center">
              <UserAvatar username={opponent.username} size="lg" color="bg-red-500" className="mb-2" />
              <p className="text-white font-semibold">{opponent.username}</p>
            </div>
          </div>
          <p className="text-gray-400 animate-pulse">{t('duel.starting')}</p>
        </div>
      </div>
    );
  }

  // Finished state
  if (duelState === 'finished' && duelResult) {
    const isWinner = duelResult.winner === user?.id;
    const isTie = duelResult.myScore === duelResult.opponentScore;

    return (
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center">
          {connectionBanner}
          <div className="text-6xl mb-4">
            {isTie ? '🤝' : isWinner ? '🏆' : '😢'}
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {isTie
              ? t('duel.tie')
              : isWinner
              ? t('duel.youWin')
              : t('duel.youLose')}
          </h1>

          <div className="flex justify-center gap-8 my-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {duelResult.myScore}
              </div>
              <div className="text-gray-400">{user?.username}</div>
            </div>
            <div className="text-2xl text-gray-500">vs</div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-400">
                {duelResult.opponentScore}
              </div>
              <div className="text-gray-400">{duelResult.opponentName}</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                setDuelState('searching');
                setSearchTime(0);
                setSearchTimedOut(false);
                socketService.joinDuelQueue(duelCategory);
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
      <div className="h-full min-h-0 bg-gray-900 flex flex-col items-center justify-center px-4">
        {connectionBanner}
        <LoadingSpinner size="lg" text={t('duel.loadingQuestion')} />
      </div>
    );
  }

  const isMapQuestion = currentQuestion.category === 'MAP';
  return (
    <GameRoundScaffold
      rootClassName="bg-gray-900"
      header={
        <header className="sticky top-0 z-30 border-b border-gray-700 bg-gray-800/95 px-3 py-2 pt-2 backdrop-blur sm:px-4">
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
        <div className="bg-gray-800/65 px-3 py-1.5 text-center sm:px-4">
          <span className="text-gray-300 text-sm">
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
      onOptionSelect={setSelectedAnswer}
      showResult={showResult}
      disableOptions={duelState === 'waiting'}
      optionsGridClassName="game-options-grid"
      actionTray={
        <RoundActionTray
          mode="duel"
          showResult={showResult}
          canSubmit={hasSelection && !isSyncingRound}
          isWaiting={duelState === 'waiting'}
          submitLabel={t('game.submit')}
          selectionAssistiveText={t('game.selectionReadyShortHint')}
          waitingLabel={t('duel.waitingForOpponent')}
          resultLabel={lastAnswerCorrect ? t('game.correct') : t('game.incorrect')}
          showResultBadge
          isCorrect={lastAnswerCorrect}
          onSubmit={handleSubmitAnswer}
        />
      }
    />
  );
}
