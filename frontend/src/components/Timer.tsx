import { useEffect, useRef } from 'react';

interface TimerProps {
  duration: number;
  timeRemaining: number;
  onTick: (time: number) => void;
  onComplete: () => void;
  isActive: boolean;
}

export function getTimerColorToken(percentage: number): string {
  if (percentage > 50) return 'var(--color-success-500)';
  if (percentage > 25) return 'var(--color-warning-500)';
  return 'var(--color-error-500)';
}

export function Timer({ duration, timeRemaining, onTick, onComplete, isActive }: TimerProps) {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      onTick(timeRemaining - 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, timeRemaining, onTick]);

  useEffect(() => {
    if (timeRemaining <= 0 && isActive) {
      onComplete();
    }
  }, [timeRemaining, isActive, onComplete]);

  const percentage = (timeRemaining / duration) * 100;
  const strokeDashoffset = 283 - (283 * percentage) / 100;
  const timerColor = getTimerColorToken(percentage);

  return (
    <div
      className="relative h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20"
      role="timer"
      aria-live="off"
      aria-label={`Tiempo restante ${Math.max(0, timeRemaining)} segundos`}
    >
      <svg className="h-14 w-14 -rotate-90 transform sm:h-16 sm:w-16 md:h-20 md:w-20" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" className="timer-ring-bg" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={timerColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="283"
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-linear shadow-glow-primary"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold transition-colors duration-300 sm:text-xl md:text-2xl" style={{ color: timerColor }}>
          {Math.max(0, timeRemaining)}
        </span>
      </div>
    </div>
  );
}
