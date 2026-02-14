import { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
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

const MapInteractive = lazy(() =>
  import('../components/MapInteractive').then((m) => ({ default: m.MapInteractive }))
);

const { TIME_PER_QUESTION, BASE_POINTS, MAX_TIME_BONUS } = GAME_CONSTANTS;

export function ChallengeGamePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [results, setResults] = useState<Array<{ isCorrect: boolean }>>([]);
  const [timeRemaining, setTimeRemaining] = useState(TIME_PER_QUESTION);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [previousScore, setPreviousScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);

  const currentQuestion = questions[currentIndex];
  const isMapQuestion = currentQuestion?.category === 'MAP';

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await api.get<{ alreadyPlayed?: boolean; questions?: Question[] }>(
          `/challenges/${id}/questions`
        );
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

  const calculatePoints = (correct: boolean, _timeSpent?: number) => {
    if (!correct) return 0;
    const timeBonus = Math.round((timeRemaining / TIME_PER_QUESTION) * MAX_TIME_BONUS);
    return BASE_POINTS + timeBonus;
  };

  const handleTimeComplete = () => {
    if (!showResult) {
      handleSubmitAnswer();
    }
  };

  const handleSubmitAnswer = () => {
    if (!currentQuestion || showResult) return;

    const timeSpent = TIME_PER_QUESTION - timeRemaining;
    let isCorrect = false;

    if (isMapQuestion) {
      if (mapLocation && currentQuestion.latitude && currentQuestion.longitude) {
        // Calculate distance
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
        const distance = R * c;
        isCorrect = distance < 300; // Within 300km is correct
      }
    } else {
      isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    }

    const points = calculatePoints(isCorrect, timeSpent);

    setPreviousScore(score);
    if (isCorrect) {
      setCorrectAnswers((prev) => prev + 1);
      setScore((prev) => prev + points);
    }

    setLastAnswerCorrect(isCorrect);
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
      // Game finished - submit result
      try {
        await api.post<{ success: boolean }>(`/challenges/${id}/submit`, {
          score: score + (lastAnswerCorrect ? calculatePoints(true) : 0),
          correctCount: correctAnswers + (lastAnswerCorrect ? 1 : 0),
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
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setMapLocation(null);
      setShowResult(false);
      setTimeRemaining(TIME_PER_QUESTION);
    }
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
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-400">
            📨 {t('challenges.challengeMode')}
          </div>

          <ScoreDisplay score={score} previousScore={previousScore} showAnimation={showResult} />

          <Timer
            duration={TIME_PER_QUESTION}
            timeRemaining={timeRemaining}
            onTick={setTimeRemaining}
            onComplete={handleTimeComplete}
            isActive={!showResult}
          />
        </div>
      </header>

      {/* Progress */}
      <div className="bg-gray-800/50 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <ProgressBar
            current={currentIndex + 1}
            total={questions.length}
            results={results}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={questions.length}
          />

          <div className="mt-6">
            {isMapQuestion ? (
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
            ) : (
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <OptionButton
                    key={option}
                    option={option}
                    index={index}
                    onClick={() => setSelectedAnswer(option)}
                    disabled={showResult}
                    selected={selectedAnswer === option}
                    isCorrect={option === currentQuestion.correctAnswer}
                    showResult={showResult}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-center">
            {!showResult ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={!selectedAnswer && !mapLocation}
                className="px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('game.submit')}
              </button>
            ) : (
              <div className="text-center">
                <div
                  className={`mb-4 text-xl font-bold ${
                    lastAnswerCorrect ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {lastAnswerCorrect ? t('game.correct') : t('game.incorrect')}
                </div>
                <button
                  onClick={handleNextQuestion}
                  className="px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/80 transition-colors"
                >
                  {currentIndex >= questions.length - 1
                    ? t('game.seeResults')
                    : t('game.next')}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
