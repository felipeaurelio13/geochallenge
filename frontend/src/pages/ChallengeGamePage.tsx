import { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import {
  Timer,
  ScoreDisplay,
  ProgressBar,
  LoadingSpinner,
  GameRoundScaffold,
} from '../components';
import { Question } from '../types';
import { GAME_CONSTANTS } from '../constants/game';

const MapInteractive = lazy(() =>
  import('../components/MapInteractive').then((m) => ({ default: m.MapInteractive }))
);

const { TIME_PER_QUESTION, BASE_POINTS, MAX_TIME_BONUS, MAP_CORRECT_THRESHOLD_KM, MAP_MAX_DISTANCE_KM } = GAME_CONSTANTS;

export function ChallengeGamePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [results, setResults] = useState<Array<{ isCorrect: boolean }>>([]);
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

  const currentQuestion = questions[currentIndex];
  const isMapQuestion = currentQuestion?.category === 'MAP';
  const hasSelection = Boolean(selectedAnswer || mapLocation);
  const isLastQuestion = currentIndex >= questions.length - 1;
  const isLowTime = !showResult && timeRemaining <= Math.max(5, Math.floor(timePerQuestion * 0.2));

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
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar el desafio');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchQuestions();
    }
  }, [id]);

  const calculatePoints = (correct: boolean, mapDistanceKm?: number) => {
    if (!correct) return 0;

    if (typeof mapDistanceKm === 'number') {
      const accuracyFactor = Math.max(0, 1 - mapDistanceKm / MAP_MAX_DISTANCE_KM);
      const accuracyPoints = Math.round(BASE_POINTS * accuracyFactor);
      const timePoints = Math.round((timeRemaining / timePerQuestion) * MAX_TIME_BONUS * accuracyFactor);
      return accuracyPoints + timePoints;
    }

    const timeBonus = Math.round((timeRemaining / timePerQuestion) * MAX_TIME_BONUS);
    return BASE_POINTS + timeBonus;
  };

  const handleTimeComplete = () => {
    if (!showResult) {
      handleSubmitAnswer();
    }
  };

  const handleSubmitAnswer = () => {
    if (!currentQuestion || showResult) return;

    let isCorrect = false;
    let mapDistance: number | undefined;

    if (isMapQuestion) {
      if (mapLocation && currentQuestion.latitude && currentQuestion.longitude) {
        const R = 6371;
        const dLat = ((currentQuestion.latitude - mapLocation.lat) * Math.PI) / 180;
        const dLon = ((currentQuestion.longitude - mapLocation.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((mapLocation.lat * Math.PI) / 180) *
            Math.cos((currentQuestion.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        mapDistance = R * c;
        isCorrect = mapDistance < MAP_CORRECT_THRESHOLD_KM;
      }
    } else {
      isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    }

    const points = calculatePoints(isCorrect, mapDistance);

    setPreviousScore(score);
    if (isCorrect) {
      setCorrectAnswers((prev) => prev + 1);
      setScore((prev) => prev + points);
    }

    setResults((prev) => {
      if (prev.length > currentIndex) {
        return prev;
      }
      return [...prev, { isCorrect }];
    });
    setShowResult(true);
  };

  const handleNextQuestion = async () => {
    if (currentIndex >= questions.length - 1) {
      try {
        setIsSubmitting(true);
        await api.post<{ success: boolean }>(`/challenges/${id}/submit`, {
          score,
          correctCount: correctAnswers,
        });
        navigate(`/challenges/${id}/results`, {
          state: {
            score: score,
            correctAnswers: correctAnswers,
            totalQuestions: questions.length,
          },
        });
      } catch (err: any) {
        alert(err.response?.data?.error || 'Error al guardar resultado');
        navigate('/challenges');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setMapLocation(null);
      setShowResult(false);
      setTimeRemaining(timePerQuestion);
    }
  };

  const handleClearSelection = () => {
    setSelectedAnswer(null);
    setMapLocation(null);
  };

  const getContextHint = () => {
    if (showResult) {
      return isLastQuestion ? t('game.tapResultsHint') : t('game.tapNextHint');
    }

    if (isLowTime) {
      return t('game.lowTimeHint', { seconds: Math.max(0, timeRemaining) });
    }

    if (isMapQuestion) {
      return mapLocation ? t('game.selectionReadyHint') : t('game.selectOnMapHint');
    }

    return selectedAnswer ? t('game.selectionReadyHint') : t('game.selectOptionHint');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text={t('game.loading')} />
      </div>
    );
  }

  if (alreadyPlayed) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('challenges.alreadyPlayed')}</h2>
          <p className="text-gray-400 mb-6">{t('challenges.alreadyPlayedDesc')}</p>
          <button
            onClick={() => navigate('/challenges')}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
          >
            {t('challenges.backToList')}
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('game.error')}</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/challenges')}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
          >
            {t('challenges.backToList')}
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <GameRoundScaffold
      rootClassName="min-h-screen bg-gray-900 flex flex-col pb-[calc(env(safe-area-inset-bottom)+4.75rem)] md:pb-8"
      mainClassName="flex-1 overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4"
      header={
        <header className="sticky top-0 z-20 border-b border-gray-700 bg-gray-800/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.6rem)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
            <button
              onClick={() => navigate('/challenges')}
              className="rounded-xl border border-gray-600 bg-gray-900/50 px-3 py-2 text-sm font-medium text-gray-100 transition-colors hover:border-primary/60 hover:text-white"
            >
              ← {t('game.exit')}
            </button>

            <div className="hidden rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:block">
              📨 {t('challenges.challengeMode')}
            </div>

            <div className="min-w-[100px] rounded-xl bg-gray-900/60 px-3 py-2">
              <ScoreDisplay score={score} previousScore={previousScore} showAnimation={showResult} />
            </div>

            <Timer
              duration={timePerQuestion}
              timeRemaining={timeRemaining}
              onTick={setTimeRemaining}
              onComplete={handleTimeComplete}
              isActive={!showResult}
            />
          </div>
        </header>
      }
      progress={
        <div className="bg-gray-800/65 px-4 py-3">
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
      optionsGridClassName={`grid gap-2.5 sm:gap-3 ${currentQuestion.category === 'FLAG' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}
      contextHint={getContextHint()}
      isLowTime={isLowTime}
      lowTimeHint={t('game.lowTimeHint', { seconds: Math.max(0, timeRemaining) })}
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
            disabled={showResult}
          />
        </Suspense>
      }
      actionTray={
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-700 bg-gradient-to-t from-gray-950 via-gray-900/95 to-gray-900/70 px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2.5 backdrop-blur sm:px-4">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between rounded-xl border border-gray-700 bg-gray-800/70 px-3 py-2 text-sm text-gray-200 sm:max-w-xs">
              <span>{t('game.questionOf', { current: currentIndex + 1, total: questions.length })}</span>
              <span className="ml-3 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-200">
                {correctAnswers}/{results.length || currentIndex + Number(showResult)}
              </span>
            </div>

            <div className="flex gap-2">
              {!showResult && hasSelection && (
                <button
                  onClick={handleClearSelection}
                  className="min-h-[48px] rounded-xl border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-100 transition-colors hover:border-gray-400"
                >
                  {t('game.clearSelection')}
                </button>
              )}

              {!showResult ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!hasSelection}
                  className="min-h-[48px] flex-1 rounded-xl bg-primary px-5 py-3 text-base font-bold text-white transition-colors hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('game.submit')}
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  disabled={isSubmitting}
                  className="min-h-[48px] flex-1 rounded-xl bg-primary px-5 py-3 text-base font-bold text-white transition-colors hover:bg-primary/85 disabled:cursor-wait disabled:opacity-70"
                >
                  {isSubmitting ? t('common.loading') : isLastQuestion ? t('game.seeResults') : t('game.next')}
                </button>
              )}
            </div>
          </div>
        </div>
      }
    />
  );
}
