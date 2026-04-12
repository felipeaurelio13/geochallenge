import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnimation } from '../hooks';
import type { AnswerResult } from '../types';

interface ScoreDisplayProps {
  score: number;
  previousScore?: number;
  showAnimation?: boolean;
  lastResult?: AnswerResult | null;
}

export function ScoreDisplay({ score, previousScore = 0, showAnimation = true, lastResult = null }: ScoreDisplayProps) {
  const { t } = useTranslation();
  const [displayScore, setDisplayScore] = useState(previousScore);
  const { isAnimating, triggerAnimation } = useAnimation(500);

  useEffect(() => {
    if (!showAnimation || score === previousScore) {
      setDisplayScore(score);
      return;
    }

    triggerAnimation();
    const difference = score - previousScore;
    const steps = 20;
    const increment = difference / steps;
    const stepDuration = 500 / steps;

    let currentStep = 0;
    const timer = window.setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayScore(score);
        window.clearInterval(timer);
      } else {
        setDisplayScore(Math.round(previousScore + increment * currentStep));
      }
    }, stepDuration);

    return () => window.clearInterval(timer);
  }, [score, previousScore, showAnimation, triggerAnimation]);

  const pointsGained = score - previousScore;
  const scoreBreakdownParts = [
    { value: lastResult?.basePoints ?? 0, label: t('game.scoreBreakdownBase') },
    { value: lastResult?.timeBonus ?? 0, label: t('game.scoreBreakdownTime') },
    { value: lastResult?.comboBonus ?? 0, label: t('game.scoreBreakdownCombo') },
    { value: lastResult?.accuracyBonus ?? 0, label: t('game.scoreBreakdownAccuracy') },
  ].filter((part) => part.value > 0);

  const scoreBreakdownText =
    scoreBreakdownParts.length > 0
      ? scoreBreakdownParts.map((part) => `${part.value} ${part.label}`).join(' + ')
      : null;

  return (
    <div className="text-center" aria-live="polite">
      <div className="text-score-label uppercase tracking-wide text-gray-400 mb-1">{t('game.score')}</div>
      <div
        className={`text-2xl sm:text-3xl font-bold transition-transform duration-200 ${
          isAnimating ? 'scale-110 text-primary' : 'text-white'
        }`}
      >
        {displayScore.toLocaleString()}
      </div>
      {showAnimation && pointsGained > 0 && isAnimating && (
        <div className="text-green-400 text-xs sm:text-sm font-semibold animate-bounce-subtle">
          {scoreBreakdownText
            ? t('game.scoreBreakdownSummary', { points: pointsGained, breakdown: scoreBreakdownText })
            : `+${pointsGained}`}
        </div>
      )}
    </div>
  );
}
