import { useEffect, useCallback, useState, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGame } from '../context/GameContext';
import {
  Timer,
  ScoreDisplay,
  ProgressBar,
  LoadingSpinner,
  GameRoundScaffold,
  RoundActionTray,
} from '../components';
import { Question } from '../types';
import { GAME_CONSTANTS } from '../constants/game';

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
  const isLoading = status === 'loading';
  const isLastQuestion = currentIndex >= questions.length - 1;
  const hasSelection = Boolean(selectedAnswer || mapLocation);
  const shouldUseCompactQuestionCard = true;

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
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text={t('game.loading')} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center px-4">
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
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text={t('game.preparing')} />
      </div>
    );
  }

  return (
    <GameRoundScaffold
      header={
        <header className="sticky top-0 z-30 border-b border-gray-700 bg-gray-800/95 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.8rem)] backdrop-blur sm:px-4 sm:pb-3 sm:pt-[calc(env(safe-area-inset-top)+0.95rem)]">
          <div className="max-w-4xl mx-auto grid grid-cols-[auto_1fr_auto] items-center gap-2.5 sm:gap-4">
            <button
              onClick={() => {
                if (window.confirm(t('game.confirmExit'))) {
                  resetGame();
                  navigate('/menu');
                }
              }}
              className="rounded-lg border border-gray-600 px-2.5 py-1.5 text-xs sm:text-sm text-gray-200 hover:text-white hover:border-gray-400 transition-colors"
              aria-label={t('game.exit')}
            >
              ✕ {t('game.exit')}
            </button>

            <ScoreDisplay score={score} previousScore={previousScore} showAnimation={showResult} />

            <div className="justify-self-end pr-[max(env(safe-area-inset-right),0.5rem)] sm:pr-[max(env(safe-area-inset-right),0.75rem)] md:pr-0">
              <Timer
                duration={TIME_PER_QUESTION}
                timeRemaining={timeRemaining}
                onTick={setTimeRemaining}
                onComplete={handleTimeComplete}
                isActive={!showResult && status === 'playing'}
              />
            </div>
          </div>
        </header>
      }
      progress={
        <div className="bg-gray-800/70 px-3 py-1 sm:px-4 sm:py-1.5">
          <div className="max-w-4xl mx-auto overflow-x-hidden">
            <ProgressBar
              current={currentIndex + 1}
              total={questions.length}
              results={results}
              showCurrentResult={showResult}
            />
          </div>
        </div>
      }
      question={currentQuestion}
      questionNumber={currentIndex + 1}
      totalQuestions={questions.length}
      compactQuestionCard={shouldUseCompactQuestionCard}
      isMapQuestion={Boolean(isMapQuestion)}
      mapContent={
        <Suspense fallback={<LoadingSpinner size="lg" text={t('game.loading')} />}>
          <MapInteractive
            questionId={currentQuestion.id}
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
      }
      selectedAnswer={selectedAnswer}
      onOptionSelect={handleOptionSelect}
      showResult={showResult}
      optionsGridClassName="grid gap-2 grid-cols-1 auto-rows-fr"
      actionTray={
        <RoundActionTray
          mode="single"
          showResult={showResult}
          canSubmit={hasSelection}
          submitLabel={t('game.submit')}
          nextLabel={isLastQuestion ? t('game.seeResults') : t('game.next')}
          resultLabel={lastAnswerCorrect ? t('game.correct') : t('game.incorrect')}
          showResultBadge
          isCorrect={lastAnswerCorrect}
          onSubmit={handleSubmitAnswer}
          onNext={handleNextQuestion}
        />
      }
    />
  );
}
