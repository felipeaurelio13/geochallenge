import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnimation } from '../hooks';

interface ScoreDisplayProps {
  score: number;
  previousScore?: number;
  showAnimation?: boolean;
}

export function ScoreDisplay({ score, previousScore = 0, showAnimation = true }: ScoreDisplayProps) {
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
          +{pointsGained}
        </div>
      )}
    </div>
  );
}
