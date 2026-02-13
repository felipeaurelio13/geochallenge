import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ScoreDisplayProps {
  score: number;
  previousScore?: number;
  showAnimation?: boolean;
}

export function ScoreDisplay({ score, previousScore = 0, showAnimation = true }: ScoreDisplayProps) {
  const { t } = useTranslation();
  const [displayScore, setDisplayScore] = useState(previousScore);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!showAnimation || score === previousScore) {
      setDisplayScore(score);
      return;
    }

    setIsAnimating(true);
    const difference = score - previousScore;
    const duration = 500; // ms
    const steps = 20;
    const increment = difference / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayScore(score);
        setIsAnimating(false);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.round(previousScore + increment * currentStep));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [score, previousScore, showAnimation]);

  const pointsGained = score - previousScore;

  return (
    <div className="text-center">
      <div className="text-sm text-gray-400 mb-1">{t('game.score')}</div>
      <div
        className={`text-3xl font-bold transition-transform duration-200 ${
          isAnimating ? 'scale-110 text-primary' : 'text-white'
        }`}
      >
        {displayScore.toLocaleString()}
      </div>
      {showAnimation && pointsGained > 0 && isAnimating && (
        <div className="text-green-400 text-sm font-semibold animate-bounce-subtle">
          +{pointsGained}
        </div>
      )}
    </div>
  );
}
