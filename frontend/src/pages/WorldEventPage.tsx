import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { LoadingSpinner, Timer } from '../components';
import { Button } from '../components/atoms/Button';
import { GeoIcon } from '../components/atoms/GeoIcon';
import { GeoMark } from '../components/atoms/GeoMark';
import type {
  WorldEventCurrentResponse,
  WorldEventBossStartResponse,
  WorldEventBossQuestion,
} from '../types';

type PageState = 'loading' | 'locked' | 'unlocked' | 'playing' | 'finished' | 'error';

function formatTimeLeft(endsAt: string, finishedLabel: string): string {
  const now = Date.now();
  const end = new Date(endsAt).getTime();
  const diff = end - now;
  if (diff <= 0) return finishedLabel;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

/**
 * Convert the server's authoritative timeRemainingMs to whole seconds for the
 * Timer. Rounds up so a resume at 0.1s still shows 1s instead of 0.
 */
function timerSecondsFromMs(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000));
}

export function WorldEventPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [eventData, setEventData] = useState<WorldEventCurrentResponse | null>(null);
  const [bossData, setBossData] = useState<WorldEventBossStartResponse | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<WorldEventBossQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState(0);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState('');
  const [lastPoints, setLastPoints] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bossHp, setBossHp] = useState(7);
  const [timeRemaining, setTimeRemaining] = useState(20);

  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load event data
  useEffect(() => {
    api.getCurrentEvent()
      .then((data) => {
        setEventData(data);
        if (data.boss.unlocked) {
          setPageState('unlocked');
        } else {
          setPageState('locked');
        }
      })
      .catch(() => {
        setError(t('worldEvent.errorLoading'));
        setPageState('error');
      });
  }, [t]);

  // Cleanup feedback timer
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const handleStartBoss = useCallback(async () => {
    try {
      setPageState('loading');
      const data = await api.startBoss();
      setBossData(data);
      setCurrentQuestion(data.question);
      setCorrectCount(data.correctCount);
      setScore(data.score);
      setBossHp(data.boss.hitsRequired - data.boss.hits);
      setTimeRemaining(timerSecondsFromMs(data.timeRemainingMs));
      setPageState('playing');
    } catch (err: any) {
      if (err?.code === 'EVENT_BOSS_LOCKED') {
        setPageState('locked');
      } else {
        setError(t('worldEvent.errorStart'));
        setPageState('error');
      }
    }
  }, [t]);

  const handleAnswer = useCallback(async (answer: string) => {
    if (!bossData || !currentQuestion || isSubmitting) return;

    setIsSubmitting(true);
    setSelected(answer);

    try {
      const result = await api.bossAnswer(bossData.attemptId, {
        questionId: currentQuestion.questionId,
        answer,
      });

      setLastAnswerCorrect(result.isCorrect);
      setLastCorrectAnswer(result.correctAnswer);
      setLastPoints(result.points);
      setShowResult(true);

      // Keep live state in sync with server truth (idempotent on retries)
      setCorrectCount(result.correctCount);
      setScore(result.score);
      setBossHp(bossData.boss.hitsRequired - result.correctCount);

      // Auto-advance after feedback
      feedbackTimerRef.current = setTimeout(() => {
        if (result.isFinal) {
          // Game finished
          setCorrectCount(result.correctCount);
          setScore(result.score);
          setPageState('finished');
        } else {
          // Next question
          setCurrentQuestion(null);
          setSelected(null);
          setShowResult(false);

          // Load next question
          api.startBoss().then((data) => {
            setBossData(data);
            setCurrentQuestion(data.question);
            setCorrectCount(data.correctCount);
            setScore(data.score);
            setBossHp(data.boss.hitsRequired - data.boss.hits);
            setTimeRemaining(timerSecondsFromMs(data.timeRemainingMs));
            setIsSubmitting(false);
          }).catch(() => {
            setError(t('worldEvent.errorNext'));
            setPageState('error');
          });
        }
      }, 2000);
    } catch (err: any) {
      setError(t('worldEvent.errorAnswer'));
      setIsSubmitting(false);
      setSelected(null);
    }
  }, [bossData, currentQuestion, isSubmitting, t]);

  const handleTimeout = useCallback(() => {
    handleAnswer('');
  }, [handleAnswer]);

  if (pageState === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <p className="text-app-secondary">{error}</p>
        <Button onClick={() => navigate('/menu')} variant="secondary">
          {t('worldEvent.backToMenu')}
        </Button>
      </div>
    );
  }

  if (pageState === 'locked' && eventData) {
    const { progress, event } = eventData;
    const region = event.region;
    const regionName = t(`worldEvent.region.${region}`);

    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-6 text-center">
          <GeoMark className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-2 text-xl font-bold text-app-text">
            {t('worldEvent.expedition', { region: regionName })}
          </h1>
          <p className="mt-1 text-sm text-app-subtle">
            {t('worldEvent.endsIn', { time: formatTimeLeft(event.endsAt, t('worldEvent.finished')) })}
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-app-text">{t('worldEvent.preparation')}</h2>

          <div className="rounded-md border border-app-border bg-app-surface p-4">
            <div className="flex items-center gap-3">
              <span className={progress.correctInRegion >= progress.correctRequired ? 'text-success-500' : 'text-app-subtle'}>
                <GeoIcon name="challenge" size={18} />
              </span>
              <div>
                <p className="text-sm font-medium text-app-text">
                  {t('worldEvent.correctAnswers', { count: progress.correctInRegion, required: progress.correctRequired })}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-app-border bg-app-surface p-4">
            <div className="flex items-center gap-3">
              <span className={progress.distinctCategories >= progress.categoriesRequired ? 'text-success-500' : 'text-app-subtle'}>
                <GeoIcon name="challenge" size={18} />
              </span>
              <div>
                <p className="text-sm font-medium text-app-text">
                  {t('worldEvent.challengeTypes', { count: progress.distinctCategories, required: progress.categoriesRequired })}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-app-border bg-app-surface p-4">
            <div className="flex items-center gap-3">
              <span className={progress.dailyCompleted ? 'text-success-500' : 'text-app-subtle'}>
                <GeoIcon name="challenge" size={18} />
              </span>
              <div>
                <p className="text-sm font-medium text-app-text">
                  {t('worldEvent.dailyCompleted')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-md border border-app-border bg-app-surface p-4">
          <div className="flex items-center gap-2">
            <GeoIcon name="close" size={17} className="text-app-subtle" />
            <p className="text-sm font-medium text-app-text">{t('worldEvent.guardianLocked')}</p>
          </div>
          <p className="mt-1 text-xs text-app-subtle">
            {t('worldEvent.guardianLockedDesc')}
          </p>
        </div>

        <Button
          onClick={() => navigate('/daily')}
          className="mt-4 w-full"
          variant="secondary"
        >
          {t('worldEvent.practiceRegion', { region: regionName })}
        </Button>
      </div>
    );
  }

  if (pageState === 'unlocked' && eventData) {
    const { boss, event } = eventData;
    const region = event.region;
    const regionName = t(`worldEvent.region.${region}`);

    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-6 text-center">
          <GeoMark className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-2 text-xl font-bold text-app-text">
            {t('worldEvent.expedition', { region: regionName })}
          </h1>
          {boss.cleared && (
            <p className="mt-1 text-sm text-success-500">
              {t('worldEvent.guardianDefeated')}
            </p>
          )}
        </div>

        {boss.cleared && (
          <div className="mb-4 rounded-md border border-success-500/30 bg-success-500/10 p-4 text-center">
            <p className="text-sm font-medium text-success-500">
              {t('worldEvent.best', { correct: boss.bestCorrect })}
            </p>
            <p className="text-xs text-app-subtle">
              {boss.attempts === 1
                ? t('worldEvent.attempts', { count: boss.attempts })
                : t('worldEvent.attemptsPlural', { count: boss.attempts })}
            </p>
          </div>
        )}

        <div className="rounded-md border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-center gap-2">
            <GeoIcon name="challenge" size={18} className="text-primary" />
            <p className="text-sm font-medium text-app-text">
              {boss.cleared ? t('worldEvent.guardianAvailable') : t('worldEvent.guardianUnlocked')}
            </p>
          </div>
          <p className="mt-1 text-xs text-app-subtle">
            {t('worldEvent.bossDescription')}
          </p>
        </div>

        <Button
          onClick={handleStartBoss}
          className="mt-4 w-full"
        >
          {boss.cleared ? t('worldEvent.playAgain') : t('worldEvent.faceGuardian')}
        </Button>

        {!boss.cleared && (
          <Button
            onClick={() => navigate('/daily')}
            className="mt-2 w-full"
            variant="secondary"
          >
            {t('worldEvent.practiceRegion', { region: regionName })}
          </Button>
        )}
      </div>
    );
  }

  if (pageState === 'playing' && bossData && currentQuestion) {
    const progress = bossData.questionIndex + 1;
    const total = bossData.totalQuestions;
    const regionName = t(`worldEvent.region.${bossData.region}`);

    return (
      <div className="mx-auto max-w-lg px-4 py-4">
        {/* Boss Header */}
        <div className="mb-4 text-center">
          <h1 className="text-lg font-bold text-app-text">
            {t('worldEvent.bossTitle', { region: regionName })}
          </h1>
          <div className="mt-2 flex justify-center gap-1">
            {Array.from({ length: bossData.boss.hitsRequired }).map((_, i) => (
              <span
                key={i}
                data-testid="boss-hp"
                aria-label={i < bossHp ? 'Vida disponible' : 'Vida perdida'}
                className={`h-2 w-5 rounded-sm ${i < bossHp ? 'bg-primary' : 'bg-app-muted'}`}
              >
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-app-subtle">
            {t('worldEvent.question', { current: progress, total })}
          </p>
        </div>

        {/* Timer */}
        <div className="mb-4">
          <Timer
            duration={bossData.timeLimit}
            timeRemaining={timeRemaining}
            onTick={setTimeRemaining}
            onComplete={handleTimeout}
            isActive={!showResult}
          />
        </div>

        {/* Question */}
        <div className="mb-4 rounded-md border border-app-border bg-app-surface p-4">
          <p className="text-sm font-medium text-app-text">
            {currentQuestion.questionText}
          </p>
          {currentQuestion.imageUrl && (
            <img
              src={currentQuestion.imageUrl}
              alt="Question"
              className="mt-2 max-h-40 rounded-lg object-contain"
            />
          )}
        </div>

        {/* Options */}
        <div className="space-y-2">
          {currentQuestion.options.map((option) => {
            const isSelected = selected === option;
            const isCorrectOption = showResult && option === lastCorrectAnswer;
            const isWrongSelected = showResult && isSelected && !lastAnswerCorrect;

            return (
              <button
                key={option}
                type="button"
                onClick={() => !showResult && handleAnswer(option)}
                disabled={showResult || isSubmitting}
                className={`w-full rounded-md border p-3 text-left text-sm font-medium transition-all ${
                  isCorrectOption
                    ? 'border-success-500 bg-success-500/10 text-success-500'
                  : isWrongSelected
                    ? 'border-error-500 bg-error-500/10 text-error-500'
                    : isSelected
                    ? 'border-primary bg-primary/20 text-app-text'
                    : 'border-app-border bg-app-surface text-app-text hover:border-primary/50'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {showResult && (
          <div className="mt-4 rounded-md border border-app-border bg-app-surface p-3 text-center">
            <p className={`text-sm font-medium ${lastAnswerCorrect ? 'text-success-500' : 'text-error-500'}`}>
              {lastAnswerCorrect
                ? t('worldEvent.correctFeedback', { points: lastPoints })
                : t('worldEvent.incorrectFeedback')}
            </p>
            {!lastAnswerCorrect && (
              <p className="mt-1 text-xs text-app-subtle">
                {t('worldEvent.answerWas', { answer: lastCorrectAnswer })}
              </p>
            )}
          </div>
        )}

        {/* Score */}
        <div className="mt-4 text-center">
          <p className="text-sm text-app-subtle">
            {t('worldEvent.scoreLine', {
              score,
              hits: bossData.boss.hitsRequired - bossHp,
              required: bossData.boss.hitsRequired,
            })}
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'finished' && bossData) {
    const cleared = correctCount >= bossData.boss.hitsRequired;

    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-6 text-center">
          <GeoMark className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-2 text-xl font-bold text-app-text">
            {cleared ? t('worldEvent.guardianDefeated') : t('worldEvent.guardianResists')}
          </h1>
          <p className="mt-1 text-2xl font-bold text-app-text">
            {correctCount} / {bossData.totalQuestions}
          </p>
          <p className="text-sm text-app-subtle">
            {score} pts
          </p>
        </div>

        {cleared && (
          <div className="mb-4 rounded-md border border-success-500/30 bg-success-500/10 p-4 text-center">
            <p className="text-sm font-medium text-success-500">
              {t('worldEvent.greatWork')}
            </p>
          </div>
        )}

        {!cleared && (
          <div className="mb-4 rounded-md border border-app-border bg-app-surface p-4 text-center">
            <p className="text-sm text-app-secondary">
              {t('worldEvent.tryAgain')}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Button onClick={handleStartBoss} className="w-full">
            {t('worldEvent.playAgain')}
          </Button>
          <Button onClick={() => navigate('/menu')} variant="secondary" className="w-full">
            {t('worldEvent.backToJourney')}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
