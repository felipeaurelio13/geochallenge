import { useEffect, useCallback, useState, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGame } from '../context/GameContext';
import {
  Timer,
  ScoreDisplay,
  ProgressBar,
  LoadingSpinner,
  AnswerStatusBadge,
  GameRoundScaffold,
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
  const isFlagQuestion = currentQuestion?.category === 'FLAG';
  const isLoading = status === 'loading';
  const isLastQuestion = currentIndex >= questions.length - 1;
  const hasSelection = Boolean(selectedAnswer || mapLocation);
  const isLowTime = timeRemaining > 0 && timeRemaining <= 5 && !showResult;
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
    <GameRoundScaffold
      header={
        <header className="sticky top-0 z-30 border-b border-gray-700 bg-gray-800/95 px-3 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur sm:px-4 sm:py-4">
          <div className="max-w-4xl mx-auto grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4">
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

            <Timer
              duration={TIME_PER_QUESTION}
              timeRemaining={timeRemaining}
              onTick={setTimeRemaining}
              onComplete={handleTimeComplete}
              isActive={!showResult && status === 'playing'}
            />
          </div>
        </header>
      }
      progress={
        <div className="bg-gray-800/70 px-3 py-2 sm:px-4 sm:py-3">
          <div className="mx-auto mb-2 flex w-full max-w-4xl items-center justify-between rounded-xl border border-gray-700 bg-gray-900/55 px-3 py-1.5 text-xs text-gray-300 sm:text-sm">
            <span>{t('game.questionOf', { current: currentIndex + 1, total: questions.length })}</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${hasSelection ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40' : 'bg-gray-700/70 text-gray-300 border border-gray-600'}`}>
              {hasSelection ? t('game.selectedOption') : t('game.submit')}
            </span>
          </div>
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
      optionsGridClassName={`grid gap-2.5 sm:gap-3 ${isFlagQuestion ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}
      contextHint={t(!hasSelection ? (isMapQuestion ? 'game.selectOnMapHint' : 'game.selectOptionHint') : 'game.selectionReadyHint')}
      isLowTime={isLowTime}
      lowTimeHint={t('game.lowTimeHint', { seconds: timeRemaining })}
      actionTray={
        <div
          className="sticky bottom-0 z-20 mt-2 -mx-1 bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent px-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 sm:mx-0 sm:mt-3 sm:bg-none sm:px-0 sm:pb-0 sm:pt-0"
          data-testid="mobile-action-tray"
        >
          {!showResult ? (
            <div className="rounded-2xl border border-gray-600 bg-gray-800/95 p-3.5 shadow-lg shadow-black/35 backdrop-blur-sm sm:bg-transparent sm:p-0 sm:border-0 sm:shadow-none sm:backdrop-blur-none">
              <div className="flex flex-col justify-center gap-2 sm:flex-row">
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!hasSelection}
                  className="w-full sm:w-auto rounded-2xl px-8 py-3.5 bg-primary text-white text-base sm:text-xl font-bold shadow-md shadow-primary/30 hover:bg-primary/85 active:scale-[0.99] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                >
                  {t('game.submit')}
                </button>

                {hasSelection && (
                  <button
                    onClick={() => {
                      setSelectedAnswer(null);
                      setMapLocation(null);
                    }}
                    className="w-full sm:w-auto rounded-2xl border border-gray-600 px-6 py-3.5 text-base sm:text-lg font-semibold text-gray-200 transition-colors hover:border-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/70"
                  >
                    {t('game.clearSelection')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center rounded-2xl border border-gray-700 bg-gray-800/95 p-3.5 sm:p-5 backdrop-blur-sm shadow-sm shadow-black/30">
              <AnswerStatusBadge
                status={lastAnswerCorrect ? 'correct' : 'incorrect'}
                label={lastAnswerCorrect ? t('game.correct') : t('game.incorrect')}
                className="mb-4 text-base"
              />

              <p className="mb-4 text-base leading-relaxed text-gray-200" aria-live="polite">{t(getPostAnswerHintKey(isLastQuestion))}</p>

              <button
                onClick={handleNextQuestion}
                className="w-full sm:w-auto rounded-2xl px-8 py-3.5 bg-primary text-white text-base sm:text-xl font-bold shadow-md shadow-primary/30 hover:bg-primary/85 active:scale-[0.99] transition-all duration-150 animate-pulse focus:outline-none focus:ring-2 focus:ring-primary/70"
              >
                {isLastQuestion ? t('game.seeResults') : t('game.next')}
              </button>
            </div>
          )}
        </div>
      }
    />
  );
}
