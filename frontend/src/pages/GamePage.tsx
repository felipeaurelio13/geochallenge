import { useEffect, useCallback, useState, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGame } from '../context/GameContext';
import { api } from '../services/api';
import {
  Timer,
  ScoreDisplay,
  ProgressBar,
  LoadingSpinner,
  GameRoundScaffold,
  RoundActionTray,
  MechanicsHud,
} from '../components';
import { FullScreenError } from '../components/molecules/FullScreenError';
import { Category, MechanicUsage, Question } from '../types';
import { GAME_CONSTANTS } from '../constants/game';
import { useHaptics } from '../hooks';
import { areMechanicsV2Enabled } from '../config/featureFlags';
import { trackUxEvent } from '../utils/uxTelemetry';

const MapInteractive = lazy(() =>
  import('../components/MapInteractive').then((m) => ({ default: m.MapInteractive }))
);

const { TIME_PER_QUESTION } = GAME_CONSTANTS;
const FOCUS_TIME_BONUS_SECONDS = 3;

function normalizeQuestionPart(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function buildQuestionUniquenessKey(question: Question): string {
  const questionData =
    typeof question.questionData === 'string' ? question.questionData : question.questionData?.country;

  return [
    normalizeQuestionPart(question.category),
    normalizeQuestionPart(question.imageUrl),
    normalizeQuestionPart(questionData),
    normalizeQuestionPart(question.correctAnswer),
  ].join('|');
}

export function GamePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'MIXED';
  const gameTypeParam = searchParams.get('gameType') ?? searchParams.get('mode');
  const gameType = gameTypeParam === 'streak' ? 'streak' : 'single';

  const {
    state,
    startGame,
    appendQuestions,
    setStreakAlive,
    submitAnswer,
    nextQuestion,
    finishGame,
    resetGame,
    setTimeRemaining: setGlobalTimeRemaining,
  } = useGame();

  const { questions, currentIndex, score, results, status } = state;
  const haptics = useHaptics();

  const [timeRemaining, setTimeRemaining] = useState(TIME_PER_QUESTION);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [streakShieldTriggered, setStreakShieldTriggered] = useState(false);
  const [pendingMechanicUsage, setPendingMechanicUsage] = useState<MechanicUsage | undefined>(undefined);
  const [disabledOptionIndexes, setDisabledOptionIndexes] = useState<number[]>([]);
  const [mechanicsAvailable, setMechanicsAvailable] = useState({
    intel5050: 1,
    focusTime: 1,
    streakShield: 1,
  });
  const [previousScore, setPreviousScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion: Question | null = questions[currentIndex] || null;
  const isMapQuestion = currentQuestion?.category === 'MAP';
  const isLoading = status === 'loading';
  const isLastQuestion = currentIndex >= questions.length - 1;
  const hasSelection = Boolean(selectedAnswer || mapLocation);
  const shouldUseCompactQuestionCard = true;
  const shouldUseStreakFlow = gameType === 'streak';
  const roundDuration = state.config?.timePerQuestion ?? TIME_PER_QUESTION;
  const mechanicsFeatureEnabled = areMechanicsV2Enabled(gameType);
  const mechanicsConfig = state.config?.mechanics;
  const mechanicsRuntimeEnabled = mechanicsFeatureEnabled && Boolean(mechanicsConfig?.enabled);
  const mechanicsAllowed = new Set(mechanicsConfig?.allowed ?? []);

  useEffect(() => {
    setGlobalTimeRemaining(timeRemaining);
  }, [setGlobalTimeRemaining, timeRemaining]);

  useEffect(() => {
    if (!mechanicsRuntimeEnabled || !mechanicsConfig) {
      setMechanicsAvailable({
        intel5050: 0,
        focusTime: 0,
        streakShield: 0,
      });
      setDisabledOptionIndexes([]);
      setPendingMechanicUsage(undefined);
      return;
    }

    const limits = mechanicsConfig?.limits;
    setMechanicsAvailable({
      intel5050: limits?.intel5050 ?? 1,
      focusTime: limits?.focusTime ?? 1,
      streakShield: shouldUseStreakFlow ? (limits?.streakShield ?? 1) : 0,
    });
    setDisabledOptionIndexes([]);
    setPendingMechanicUsage(undefined);
  }, [mechanicsConfig, mechanicsRuntimeEnabled, shouldUseStreakFlow]);

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
        await startGame(category as Category, undefined, gameType);
      } catch (err: any) {
        setError(err.message || 'Error al iniciar el juego');
      }
    };
    initGame();
  }, [category, gameType, startGame]);

  // Keyboard shortcuts: A/B/C/D to select, Enter to submit/next
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!currentQuestion || isMapQuestion) return;

      if (!showResult) {
        const keyMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
        const idx = keyMap[e.key.toLowerCase()];
        if (idx !== undefined && idx < currentQuestion.options.length) {
          if (disabledOptionIndexes.includes(idx)) {
            trackUxEvent('option_mis_tap', {
              mode: gameType,
              questionId: currentQuestion.id,
              value: idx,
            });
            return;
          }
          setSelectedAnswer(currentQuestion.options[idx]);
        }
        if (e.key === 'Enter' && selectedAnswer) {
          handleSubmitAnswer();
        }
      } else if (e.key === 'Enter' || e.key.toLowerCase() === 'n') {
        handleNextQuestion();
      }
    },
    [currentQuestion, disabledOptionIndexes, gameType, isMapQuestion, showResult, selectedAnswer]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Handle time running out
  const handleTimeComplete = () => {
    if (!showResult && status === 'playing') {
      trackUxEvent('round_timeout', {
        mode: gameType,
        questionId: currentQuestion?.id,
        value: 0,
      });
      handleSubmitAnswer();
    }
  };

  const handleUseIntel5050 = () => {
    if (!currentQuestion || isMapQuestion || showResult || !mechanicsRuntimeEnabled) return;
    if (!mechanicsAllowed.has('intel5050') || mechanicsAvailable.intel5050 <= 0) return;

    const selectedIndex = selectedAnswer ? currentQuestion.options.indexOf(selectedAnswer) : -1;
    const incorrectIndexes = currentQuestion.options
      .map((option, index) => ({ option, index }))
      .filter(({ option, index }) => option !== currentQuestion.correctAnswer && index !== selectedIndex)
      .map(({ index }) => index);

    if (incorrectIndexes.length === 0) return;

    const randomized = [...incorrectIndexes].sort(() => Math.random() - 0.5);
    const removedIndexes = randomized.slice(0, Math.min(2, randomized.length));
    setDisabledOptionIndexes(removedIndexes);
    setMechanicsAvailable((prev) => ({
      ...prev,
      intel5050: Math.max(0, prev.intel5050 - 1),
    }));
    setPendingMechanicUsage({
      key: 'intel5050',
      action: 'trigger',
      questionId: currentQuestion.id,
      roundIndex: currentIndex,
      value: removedIndexes.length,
    });
    trackUxEvent('mechanic_used', {
      mode: gameType,
      questionId: currentQuestion.id,
      value: removedIndexes.length,
      meta: { key: 'intel5050' },
    });
    haptics.tap();
  };

  const handleUseFocusTime = () => {
    if (!mechanicsRuntimeEnabled || !mechanicsAllowed.has('focusTime')) return;
    if (mechanicsAvailable.focusTime <= 0 || showResult || status !== 'playing') return;

    const nextTime = Math.min(roundDuration + FOCUS_TIME_BONUS_SECONDS, timeRemaining + FOCUS_TIME_BONUS_SECONDS);
    setTimeRemaining(nextTime);
    setGlobalTimeRemaining(nextTime);
    setMechanicsAvailable((prev) => ({
      ...prev,
      focusTime: Math.max(0, prev.focusTime - 1),
    }));
    setPendingMechanicUsage({
      key: 'focusTime',
      action: 'trigger',
      questionId: currentQuestion?.id,
      roundIndex: currentIndex,
      value: FOCUS_TIME_BONUS_SECONDS,
    });
    trackUxEvent('mechanic_used', {
      mode: gameType,
      questionId: currentQuestion?.id,
      value: FOCUS_TIME_BONUS_SECONDS,
      meta: { key: 'focusTime' },
    });
    haptics.tap();
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
      const result = await submitAnswer(answer, mapLocation || undefined, pendingMechanicUsage);
      setPendingMechanicUsage(undefined);
      trackUxEvent('round_submitted', {
        mode: gameType,
        questionId: currentQuestion.id,
        value: result.points,
      });
      if (result.isCorrect) {
        haptics.success();
      } else {
        haptics.error();
      }

      if (
        shouldUseStreakFlow &&
        !result.isCorrect &&
        mechanicsRuntimeEnabled &&
        mechanicsAllowed.has('streakShield') &&
        mechanicsAvailable.streakShield > 0
      ) {
        setMechanicsAvailable((prev) => ({
          ...prev,
          streakShield: Math.max(0, prev.streakShield - 1),
        }));
        setStreakShieldTriggered(true);
        trackUxEvent('mechanic_used', {
          mode: gameType,
          questionId: currentQuestion.id,
          value: 1,
          meta: { key: 'streakShield' },
        });
        setLastAnswerCorrect(false);
        setShowResult(true);
        return;
      }

      if (shouldUseStreakFlow && !result.isCorrect) {
        setStreakAlive(false);
        try {
          await finishGame();
        } catch {
          // noop: navega a resultados de racha incluso si el cierre falla
        }
        navigate('/results?gameType=streak');
        return;
      }

      setStreakShieldTriggered(false);
      setLastAnswerCorrect(result.isCorrect);
      setShowResult(true);
    } catch (err: any) {
      console.error('Error submitting answer:', err);
      setError(err.message || t('game.error'));
    }
  };

  // Move to next question
  const handleNextQuestion = async () => {
    let bufferedQuestionCount = questions.length;

    if (shouldUseStreakFlow) {
      const remainingBufferedQuestions = questions.length - (currentIndex + 1);
      if (remainingBufferedQuestions <= 2) {
        try {
          const usedQuestionIds = questions.map((question) => question.id);
          const usedQuestionKeys = questions.map((question) => buildQuestionUniquenessKey(question));
          const refillResponse = await api.startGame(
            category as Category,
            10,
            'streak',
            usedQuestionIds,
            usedQuestionKeys
          );
          appendQuestions(refillResponse.questions);
          bufferedQuestionCount += refillResponse.questions.length;
        } catch (err) {
          console.error('Error preloading streak questions:', err);
        }
      }
    }

    if (currentIndex >= bufferedQuestionCount - 1) {
      // Game finished
      try {
        await finishGame();
        navigate(shouldUseStreakFlow ? '/results?gameType=streak' : '/results');
      } catch (err) {
        navigate(shouldUseStreakFlow ? '/results?gameType=streak' : '/results');
      }
    } else {
      nextQuestion();
      setSelectedAnswer(null);
      setMapLocation(null);
      setShowResult(false);
      setTimeRemaining(roundDuration);
      setGlobalTimeRemaining(roundDuration);
      setDisabledOptionIndexes([]);
      setPendingMechanicUsage(undefined);
      setStreakShieldTriggered(false);
    }
  };

  // Handle option selection
  const handleOptionSelect = (option: string) => {
    if (!showResult) {
      const selectedIndex = currentQuestion?.options.indexOf(option) ?? -1;
      if (selectedIndex >= 0 && disabledOptionIndexes.includes(selectedIndex)) {
        trackUxEvent('option_mis_tap', {
          mode: gameType,
          questionId: currentQuestion?.id,
          value: selectedIndex,
        });
        return;
      }
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
      <FullScreenError
        title={t('game.error')}
        message={error || undefined}
        backTo="/menu"
        backLabel={t('common.backToMenu')}
      />
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
        <header className="sticky top-0 z-30 border-b border-gray-700 bg-gray-800/95 px-3 pb-2 pt-3 backdrop-blur sm:px-4 sm:pb-3 sm:pt-4">
          <div className="max-w-4xl mx-auto grid grid-cols-[auto_1fr_auto] items-center gap-2.5 sm:gap-4">
            <button
              onClick={() => {
                if (window.confirm(t('game.confirmExit'))) {
                  trackUxEvent('round_abandon', {
                    mode: gameType,
                    questionId: currentQuestion?.id,
                    value: currentIndex,
                  });
                  resetGame();
                  navigate('/menu');
                }
              }}
              className="rounded-lg border border-gray-600 px-2.5 py-1.5 text-xs sm:text-sm text-gray-200 hover:text-white hover:border-gray-400 transition-colors"
              aria-label={t('game.exit')}
            >
              ✕ {t('game.exit')}
            </button>

            <ScoreDisplay
              score={score}
              previousScore={previousScore}
              showAnimation={showResult}
              lastResult={results[results.length - 1] ?? null}
            />

            <div className="justify-self-end pr-[max(env(safe-area-inset-right),0.5rem)] sm:pr-[max(env(safe-area-inset-right),0.75rem)] md:pr-0">
              <Timer
                duration={roundDuration}
                timeRemaining={timeRemaining}
                onTick={(time) => {
                  setTimeRemaining(time);
                  setGlobalTimeRemaining(time);
                }}
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
      hiddenOptionIndexes={disabledOptionIndexes}
      optionsGridClassName="game-options-grid"
      actionTray={
        <RoundActionTray
          mode="single"
          showResult={showResult}
          canSubmit={hasSelection}
          submitLabel={t('game.submit')}
          nextLabel={shouldUseStreakFlow ? t('game.next') : isLastQuestion ? t('game.seeResults') : t('game.next')}
          resultLabel={lastAnswerCorrect ? t('game.correct') : t('game.incorrect')}
          resultHint={streakShieldTriggered ? t('mechanics.streakShieldTriggered') : undefined}
          selectionAssistiveText={hasSelection && !showResult ? t('game.selectionReadyShortHint') : undefined}
          showResultBadge
          isCorrect={lastAnswerCorrect}
          onSubmit={handleSubmitAnswer}
          onNext={handleNextQuestion}
          summarySlot={
            mechanicsRuntimeEnabled && !showResult ? (
              <MechanicsHud
                available={mechanicsAvailable}
                disabled={false}
                onUseIntel5050={handleUseIntel5050}
                onUseFocusTime={handleUseFocusTime}
                showShieldStatus={shouldUseStreakFlow}
              />
            ) : undefined
          }
        />
      }
    />
  );
}
