import { useEffect, useCallback, useState, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGame } from '../context/GameContext';
import {
  Timer,
  QuestionCard,
  OptionButton,
  ScoreDisplay,
  ProgressBar,
  LoadingSpinner,
} from '../components';
import { Question } from '../types';
import { GAME_CONSTANTS } from '../constants/game';
import { getPostAnswerHintKey } from '../utils/gameFlow';

const MapInteractive = lazy(() =>
  import('../components/MapInteractive').then((m) => ({ default: m.MapInteractive }))
);

const { TIME_PER_QUESTION } = GAME_CONSTANTS;

export function GamePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'MIXED';

  const {
    state,
    startGame,
    submitAnswer,
    nextQuestion,
    finishGame,
    resetGame,
  } = useGame();

  const { questions, currentIndex, score, results, status } = state;

  const [timeRemaining, setTimeRemaining] = useState(TIME_PER_QUESTION);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [previousScore, setPreviousScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion: Question | null = questions[currentIndex] || null;
  const isMapQuestion = currentQuestion?.category === 'MAP';
  const correctAnswers = results.filter(r => r.isCorrect).length;
  const isLoading = status === 'loading';
  const isLastQuestion = currentIndex >= questions.length - 1;

  // Prevent accidental navigation during game
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'playing' || status === 'reviewing') {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status]);

  // Start game on mount
  useEffect(() => {
    const initGame = async () => {
      try {
        await startGame(category as any);
      } catch (err: any) {
        setError(err.message || 'Error al iniciar el juego');
      }
    };
    initGame();

    return () => {
      resetGame();
    };
  }, [category]);

  // Keyboard shortcuts: A/B/C/D to select, Enter to submit/next
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!currentQuestion || isMapQuestion) return;

      if (!showResult) {
        const keyMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
        const idx = keyMap[e.key.toLowerCase()];
        if (idx !== undefined && idx < currentQuestion.options.length) {
          setSelectedAnswer(currentQuestion.options[idx]);
        }
        if (e.key === 'Enter' && selectedAnswer) {
          handleSubmitAnswer();
        }
      } else if (e.key === 'Enter' || e.key.toLowerCase() === 'n') {
        handleNextQuestion();
      }
    },
    [currentQuestion, isMapQuestion, showResult, selectedAnswer]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Handle time running out
  const handleTimeComplete = () => {
    if (!showResult && status === 'playing') {
      handleSubmitAnswer();
    }
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (!currentQuestion || showResult) return;

    let answer: string;
    if (isMapQuestion) {
      answer = mapLocation ? `${mapLocation.lat},${mapLocation.lng}` : '0,0';
    } else {
      answer = selectedAnswer || '';
    }

    setPreviousScore(score);

    try {
      const result = await submitAnswer(answer, mapLocation || undefined);
      setLastAnswerCorrect(result.isCorrect);
      setShowResult(true);
    } catch (err: any) {
      console.error('Error submitting answer:', err);
    }
  };

  // Move to next question
  const handleNextQuestion = async () => {
    if (currentIndex >= questions.length - 1) {
      // Game finished
      try {
        await finishGame();
        navigate('/results');
      } catch (err) {
        navigate('/results');
      }
    } else {
      nextQuestion();
      setSelectedAnswer(null);
      setMapLocation(null);
      setShowResult(false);
      setTimeRemaining(TIME_PER_QUESTION);
    }
  };

  // Handle option selection
  const handleOptionSelect = (option: string) => {
    if (!showResult) {
      setSelectedAnswer(option);
    }
  };

  // Handle map location selection
  const handleMapSelect = (lat: number, lng: number) => {
    if (!showResult) {
      setMapLocation({ lat, lng });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text={t('game.loading')} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('game.error')}</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/menu')}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
          >
            {t('common.backToMenu')}
          </button>
        </div>
      </div>
    );
  }

  // No question loaded yet
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text={t('game.preparing')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              if (window.confirm(t('game.confirmExit'))) {
                resetGame();
                navigate('/menu');
              }
            }}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label={t('game.exit')}
          >
            ✕ {t('game.exit')}
          </button>

          <ScoreDisplay score={score} previousScore={previousScore} showAnimation={showResult} />

          <Timer
            duration={TIME_PER_QUESTION}
            timeRemaining={timeRemaining}
            onTick={setTimeRemaining}
            onComplete={handleTimeComplete}
            isActive={!showResult && status === 'playing'}
          />
        </div>
      </header>

      {/* Progress */}
      <div className="bg-gray-800/50 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <ProgressBar
            current={currentIndex + 1}
            total={questions.length}
            correctAnswers={correctAnswers}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Question Card */}
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={questions.length}
          />

          {/* Answer Options or Map */}
          <div className="mt-6">
            {isMapQuestion ? (
              <Suspense fallback={<LoadingSpinner size="lg" text={t('game.loading')} />}>
                <MapInteractive
                  onLocationSelect={handleMapSelect}
                  selectedLocation={mapLocation}
                  correctLocation={
                    showResult && currentQuestion.latitude && currentQuestion.longitude
                      ? { lat: currentQuestion.latitude, lng: currentQuestion.longitude }
                      : null
                  }
                  showResult={showResult}
                  disabled={showResult}
                />
              </Suspense>
            ) : (
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <OptionButton
                    key={option}
                    option={option}
                    index={index}
                    onClick={() => handleOptionSelect(option)}
                    disabled={showResult}
                    selected={selectedAnswer === option}
                    isCorrect={option === currentQuestion.correctAnswer}
                    showResult={showResult}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 sticky bottom-3 z-10">
            {!showResult ? (
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
                    className="w-full sm:w-auto px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('game.submit')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center rounded-xl border border-gray-700 bg-gray-800/95 p-4 backdrop-blur-sm">
                {/* Result feedback */}
                <div
                  className={`mb-4 text-xl font-bold ${
                    lastAnswerCorrect ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {lastAnswerCorrect ? t('game.correct') : t('game.incorrect')}
                </div>

                <p className="mb-3 text-sm text-gray-300">{t(getPostAnswerHintKey(isLastQuestion))}</p>

                <button
                  onClick={handleNextQuestion}
                  className="w-full sm:w-auto px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/80 transition-colors animate-pulse"
                >
                  {isLastQuestion ? t('game.seeResults') : t('game.next')}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
