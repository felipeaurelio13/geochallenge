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
    <div className="relative w-20 h-20">
      <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
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
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      {/* Time text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-2xl font-bold transition-colors duration-300"
          style={{ color: getColor() }}
        >
          {Math.max(0, timeRemaining)}
        </span>
      </div>
    </div>
  );
}
