import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { MonumentAttribution } from '../components/MonumentAttribution';
import { Question } from '../types';
import { getApiErrorMessage } from '../utils/apiError';
import { useHaptics } from '../hooks';
import { areMechanicsV2Enabled } from '../config/featureFlags';
import { getQuestionDuration } from '../utils/questionTiming';
import { trackUxEvent } from '../utils/uxTelemetry';

const MapInteractive = lazy(() =>
  import('../components/MapInteractive').then((m) => ({ default: m.MapInteractive }))
);

const TIME_PER_QUESTION = 10;

export function ChallengeGamePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, _setScore] = useState(0);
  const [results, setResults] = useState<Array<{ isCorrect?: boolean }>>([]);
  // Respuestas crudas para el backend: el servidor las valida y calcula el score.
  const answersRef = useRef<
    Array<{
      questionId: string;
      answer?: string;
      mapAnswer?: { lat: number; lng: number };
      timeRemaining: number;
    }>
  >([]);
  const haptics = useHaptics();
  const [timePerQuestion, setTimePerQuestion] = useState(TIME_PER_QUESTION);
  const [timeRemaining, setTimeRemaining] = useState(TIME_PER_QUESTION);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [previousScore, setPreviousScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disabledOptionIndexes, setDisabledOptionIndexes] = useState<number[]>([]);
  const [mechanicsAvailable, setMechanicsAvailable] = useState({
    intel5050: 0,
    focusTime: 1,
    streakShield: 0,
  });
  const mechanicsEnabled = areMechanicsV2Enabled('challenge');
  const runStartedRef = useRef(false);
  const abandonTrackedRef = useRef(false);

  const currentQuestion = questions[currentIndex];
  const isMapQuestion = currentQuestion?.category === 'MAP';
  const hasSelection = Boolean(selectedAnswer || mapLocation);
  const isLastQuestion = currentIndex >= questions.length - 1;
  const effectiveDuration = getQuestionDuration(currentQuestion?.category, timePerQuestion);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await api.get<{ alreadyPlayed?: boolean; questions?: Question[]; answerTimeSeconds?: number }>(
          `/challenges/${id}/questions`
        );
        if (response.answerTimeSeconds) {
          setTimePerQuestion(response.answerTimeSeconds);
          setTimeRemaining(response.answerTimeSeconds);
        }

        if (response.alreadyPlayed) {
          setAlreadyPlayed(true);
        } else if (response.questions) {
          setQuestions(response.questions);
          runStartedRef.current = true;
        }
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, t('challenges.loadError')));
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchQuestions();
    }
  }, [id]);

  useEffect(() => {
    return () => {
      if (!abandonTrackedRef.current && runStartedRef.current && !isSubmitting) {
        abandonTrackedRef.current = true;
        trackUxEvent('game_abandoned', {
          mode: 'challenge',
          variant: 'CLASSIC',
          roundIndex: currentIndex,
          reason: 'navigation',
        });
      }
    };
  }, [currentIndex, isSubmitting]);

  const handleTimeComplete = () => {
    if (!showResult) {
      handleSubmitAnswer();
    }
  };

  const handleSubmitAnswer = () => {
    if (!currentQuestion || showResult) return;

    if (answersRef.current.length <= currentIndex) {
      answersRef.current.push({
        questionId: currentQuestion.id,
        answer: !isMapQuestion && selectedAnswer ? selectedAnswer : undefined,
        mapAnswer: isMapQuestion && mapLocation ? mapLocation : undefined,
        timeRemaining: Math.max(0, timeRemaining),
      });
    }

    setPreviousScore(score);
    haptics.tap();

    setResults((prev) => {
      if (prev.length > currentIndex) {
        return prev;
      }
      return [...prev, {}];
    });
    setShowResult(true);
  };

  const handleUseIntel5050 = () => {
    // Disabled in Challenge until server-authoritative mechanic support is available.
    // Cannot determine incorrect options without access to correctAnswer from the server.
  };

  const handleUseFocusTime = () => {
    if (!mechanicsEnabled || showResult || mechanicsAvailable.focusTime <= 0) return;
    const bonusSeconds = 3;
    const nextTime = Math.min(timePerQuestion + bonusSeconds, timeRemaining + bonusSeconds);
    setTimeRemaining(nextTime);
    setMechanicsAvailable((prev) => ({ ...prev, focusTime: Math.max(0, prev.focusTime - 1) }));
    haptics.tap();
  };

  const handleNextQuestion = async () => {
    if (currentIndex >= questions.length - 1) {
      try {
        setIsSubmitting(true);
        abandonTrackedRef.current = true;
        const response = await api.post<{ result?: { score: number; correctCount: number } }>(
          `/challenges/${id}/submit`,
          { answers: answersRef.current }
        );
        navigate(`/challenges/${id}/results`, {
          state: {
            score: response.result?.score ?? score,
            correctAnswers: response.result?.correctCount ?? 0,
            totalQuestions: questions.length,
          },
        });
      } catch (err: unknown) {
        // El estado `error` renderiza FullScreenError con botón de volver a /challenges.
        setError(getApiErrorMessage(err, t('challenges.submitError')));
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setSelectedAnswer(null);
      setMapLocation(null);
      setShowResult(false);
      setTimeRemaining(getQuestionDuration(questions[nextIdx]?.category, timePerQuestion));
      setDisabledOptionIndexes([]);
    }
  };

  if (loading) {
    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex items-center justify-center">
        <LoadingSpinner size="lg" text={t('game.loading')} />
      </div>
    );
  }

  if (alreadyPlayed) {
    return (
      <FullScreenError
        emoji="✅"
        title={t('challenges.alreadyPlayed')}
        message={t('challenges.alreadyPlayedDesc')}
        backTo="/challenges"
        backLabel={t('challenges.backToList')}
      />
    );
  }

  if (error) {
    return (
      <FullScreenError
        title={t('game.error')}
        message={error || undefined}
        backTo="/challenges"
        backLabel={t('challenges.backToList')}
      />
    );
  }

  if (!currentQuestion) {
    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <GameRoundScaffold
      rootClassName="bg-[var(--color-bg-app)]"
      header={
        <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 pb-2 pt-2 backdrop-blur sm:px-4">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
            <button
              onClick={() => { abandonTrackedRef.current = true; runStartedRef.current = false; navigate('/challenges'); }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-primary/60 hover:text-app-text"
            >
              ← {t('game.exit')}
            </button>

            <div className="hidden rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:block">
              📨 {t('challenges.challengeMode')}
            </div>

            <div className="min-w-chip rounded-xl bg-[var(--color-surface)] px-3 py-2">
              <ScoreDisplay score={score} previousScore={previousScore} showAnimation={showResult} />
            </div>

            <Timer
              duration={effectiveDuration}
              timeRemaining={timeRemaining}
              onTick={setTimeRemaining}
              onComplete={handleTimeComplete}
              isActive={!showResult}
            />
          </div>
        </header>
      }
      progress={
        <div className="bg-app-muted/65 px-3 py-1.5 sm:px-4">
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
      isMapQuestion={Boolean(isMapQuestion)}
      selectedAnswer={selectedAnswer}
      onOptionSelect={setSelectedAnswer}
      showResult={showResult}
      hiddenOptionIndexes={disabledOptionIndexes}
      optionsGridClassName="game-options-grid"
      mapContent={
        <Suspense fallback={<LoadingSpinner size="lg" />}>
          <MapInteractive
            questionId={currentQuestion.id}
            onLocationSelect={(lat, lng) => setMapLocation({ lat, lng })}
            selectedLocation={mapLocation}
            correctLocation={null}
            showResult={showResult}
            disabled={showResult}
          />
        </Suspense>
      }
      actionTray={
        <RoundActionTray
          mode="challenge"
          showResult={showResult}
          canSubmit={hasSelection}
          isSubmitting={isSubmitting}
          submitLabel={t('game.submit')}
          selectionAssistiveText={t('game.selectionReadyShortHint')}
          nextLabel={isSubmitting ? t('common.loading') : isLastQuestion ? t('game.seeResults') : t('game.next')}
          resultAttribution={
            currentQuestion && currentQuestion.category === 'MONUMENT'
              ? <MonumentAttribution question={currentQuestion} />
              : undefined
          }
          onSubmit={handleSubmitAnswer}
          onNext={handleNextQuestion}
          summarySlot={
            mechanicsEnabled ? (
              <MechanicsHud
                available={mechanicsAvailable}
                disabled={showResult}
                onUseIntel5050={handleUseIntel5050}
                onUseFocusTime={handleUseFocusTime}
              />
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)] sm:max-w-xs">
                <span>{t('game.questionOf', { current: currentIndex + 1, total: questions.length })}</span>
              </div>
            )
          }
        />
      }
    />
  );
}
