import { useEffect, useState, useCallback, lazy, Suspense, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socket';
import {
  Timer,
  QuestionCard,
  OptionButton,
  LoadingSpinner,
  AnswerStatusBadge,
} from '../components';
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
  const scoreRef = useRef(0);
  const opponentRef = useRef<{ id: string; username: string } | null>(null);
  const duelCategory = parseDuelCategory(searchParams.get('category'));

  useEffect(() => {
    scoreRef.current = myScore;
  }, [myScore]);

  useEffect(() => {
    opponentRef.current = opponent;
  }, [opponent]);

  // Connect to socket and join queue
  useEffect(() => {
    socketService.connect();

    // Search timer
    const searchTimer = setInterval(() => {
      setSearchTime((prev) => prev + 1);
    }, 1000);

    // Event handlers
    const handleMatched = (data: any) => {
      if (data.opponent) {
        setOpponent(data.opponent);
      }
      setDuelState('matched');
      clearInterval(searchTimer);

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
      setDuelState('playing');
    };

    const handleAnswerResult = (data: any) => {
      const myResult = data.results?.find((result: any) => result.userId === user?.id);
      const rivalResult = data.results?.find((result: any) => result.userId !== user?.id);

      setShowResult(true);
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

    // Register event listeners
    socketService.socket?.on('duel:matched', handleMatched);
    socketService.socket?.on('duel:opponent', handleOpponent);
    socketService.socket?.on('duel:question', handleQuestion);
    socketService.socket?.on('duel:questionResult', handleAnswerResult);
    socketService.socket?.on('duel:finished', handleDuelFinished);
    socketService.socket?.on('duel:opponent-disconnected', handleOpponentDisconnected);

    // Join matchmaking queue after listeners are active
    socketService.joinDuelQueue(duelCategory);

    return () => {
      clearInterval(searchTimer);
      socketService.cancelDuelQueue();
      socketService.socket?.off('duel:matched', handleMatched);
      socketService.socket?.off('duel:opponent', handleOpponent);
      socketService.socket?.off('duel:question', handleQuestion);
      socketService.socket?.off('duel:questionResult', handleAnswerResult);
      socketService.socket?.off('duel:finished', handleDuelFinished);
      socketService.socket?.off('duel:opponent-disconnected', handleOpponentDisconnected);
    };
  }, [duelCategory, user?.id]);

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
    if (!currentQuestion || showResult) return;

    const isMapQuestion = currentQuestion.category === 'MAP';
    let answer: string;
    let coordinates: { lat: number; lng: number } | undefined;

    if (isMapQuestion) {
      coordinates = mapLocation || undefined;
      answer = mapLocation ? `${mapLocation.lat},${mapLocation.lng}` : '0,0';
    } else {
      answer = selectedAnswer || '';
    }

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

  // Searching state
  if (duelState === 'searching') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-pulse">⚔️</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {t('duel.searching')}
          </h1>
          <p className="text-gray-400 mb-6">{t('duel.waitingForOpponent')}</p>
          <div className="mb-6">
            <LoadingSpinner size="lg" />
          </div>
          <p className="text-gray-500 mb-6">{formatSearchTime(searchTime)}</p>
          <button
            onClick={handleCancelSearch}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            {t('duel.cancel')}
          </button>
        </div>
      </div>
    );
  }

  // Matched state
  if (duelState === 'matched' && opponent) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-8">
            {t('duel.opponentFound')}
          </h1>
          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-3xl font-bold text-white mb-2">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <p className="text-white font-semibold">{user?.username}</p>
            </div>
            <div className="text-4xl animate-pulse">⚔️</div>
            <div className="text-center">
              <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-2">
                {opponent.username.charAt(0).toUpperCase()}
              </div>
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center">
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
            <button
              onClick={() => {
                setDuelState('searching');
                setSearchTime(0);
                socketService.joinDuelQueue(duelCategory);
              }}
              className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/80 transition-colors"
            >
              {t('duel.playAgain')}
            </button>
            <button
              onClick={() => navigate('/menu')}
              className="w-full py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors"
            >
              {t('common.backToMenu')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing state
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text={t('duel.loadingQuestion')} />
      </div>
    );
  }

  const isMapQuestion = currentQuestion.category === 'MAP';

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header with scores */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-bold text-white">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
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
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-sm font-bold text-white">
              {opponent?.username?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-gray-800/50 px-4 py-2 text-center">
        <span className="text-gray-400">
          {t('game.questionOf', { current: questionNumber, total: totalQuestions })}
        </span>
      </div>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <QuestionCard
            question={currentQuestion}
            questionNumber={questionNumber}
            totalQuestions={totalQuestions}
          />

          <div className="mt-6">
            {isMapQuestion ? (
              <Suspense fallback={<LoadingSpinner size="lg" />}>
                <MapInteractive
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
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {currentQuestion.options.map((option, index) => (
                  <OptionButton
                    key={option}
                    option={option}
                    index={index}
                    onClick={() => setSelectedAnswer(option)}
                    disabled={showResult || duelState === 'waiting'}
                    selected={selectedAnswer === option}
                    isCorrect={option === currentQuestion.correctAnswer}
                    showResult={showResult}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="mt-6 sticky bottom-2 z-20">
            {duelState === 'playing' && !showResult && (
              <div className="rounded-xl border border-gray-700 bg-gray-800/95 p-3 backdrop-blur-sm sm:bg-transparent sm:p-0 sm:border-0 sm:backdrop-blur-none">
                {(selectedAnswer || mapLocation) && (
                  <p className="mb-2 text-center text-sm text-primary font-medium">
                    {t('game.selectionReadyHint')}
                  </p>
                )}
                <div className="flex justify-center">
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!selectedAnswer && !mapLocation}
                    className="w-full sm:w-auto px-8 py-3.5 bg-primary text-white font-bold rounded-xl shadow-md shadow-primary/30 hover:bg-primary/85 active:scale-[0.99] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('game.submit')}
                  </button>
                </div>
              </div>
            )}
            {duelState === 'waiting' && (
              <div className="text-center">
                <LoadingSpinner size="sm" />
                <p className="text-gray-400 mt-2">{t('duel.waitingForOpponent')}</p>
              </div>
            )}
            {showResult && (
              <div className="text-center rounded-xl border border-gray-700 bg-gray-800/95 p-4 backdrop-blur-sm">
                <AnswerStatusBadge
                  status={lastAnswerCorrect ? 'correct' : 'incorrect'}
                  label={lastAnswerCorrect ? t('game.correct') : t('game.incorrect')}
                  className="text-base"
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
