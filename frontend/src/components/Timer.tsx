import { useEffect, useRef } from 'react';

interface TimerProps {
  duration: number;
  timeRemaining: number;
  onTick: (time: number) => void;
  onComplete: () => void;
  isActive: boolean;
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

  // Calculate percentage for visual
  const percentage = (timeRemaining / duration) * 100;
  const strokeDashoffset = 283 - (283 * percentage) / 100;

  // Color based on time remaining
  const getColor = () => {
    if (percentage > 50) return '#22c55e'; // green
    if (percentage > 25) return '#eab308'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div
      className="relative h-16 w-16 sm:h-20 sm:w-20"
      role="timer"
      aria-live="off"
      aria-label={`Tiempo restante ${Math.max(0, timeRemaining)} segundos`}
    >
      <svg className="h-16 w-16 transform -rotate-90 sm:h-20 sm:w-20" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#374151"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={getColor()}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="283"
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-linear drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]"
        />
      </svg>
      {/* Time text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-xl font-bold transition-colors duration-300 sm:text-2xl"
          style={{ color: getColor() }}
        >
          {Math.max(0, timeRemaining)}
        </span>
      </div>
    </div>
  );
}
