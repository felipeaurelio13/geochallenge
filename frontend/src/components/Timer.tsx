import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { triggerHaptic } from '../hooks/useHaptics';
import { useUiStore } from '../store/useUiStore';

const URGENCY_THRESHOLD_SECONDS = 3;
const HURRY_ANNOUNCE_THRESHOLD_SECONDS = 5;

interface TimerProps {
  duration: number;
  timeRemaining: number;
  onTick: (time: number) => void;
  onComplete: () => void;
  isActive: boolean;
  compact?: boolean;
}

export function getTimerColorToken(percentage: number): string {
  if (percentage > 30) return 'var(--color-primary-500)';
  if (percentage > 10) return 'var(--color-warning-500)';
  return 'var(--color-error-500)';
}

export function Timer({ duration, timeRemaining, onTick, onComplete, isActive, compact = false }: TimerProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useUiStore((state) => state.prefersReducedMotion);
  const intervalRef = useRef<number | null>(null);
  const timeRemainingRef = useRef(timeRemaining);
  const onTickRef = useRef(onTick);
  const onCompleteRef = useRef(onComplete);
  const hasAnnouncedHurryRef = useRef(false);
  const hasTriggeredWarningHapticRef = useRef(false);
  const prevTimeRemainingRef = useRef(timeRemaining);
  const [hurryAnnouncement, setHurryAnnouncement] = useState('');

  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      const newTime = timeRemainingRef.current - 1;
      onTickRef.current(newTime);
      if (newTime <= 0) {
        onCompleteRef.current();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  useEffect(() => {
    if (timeRemaining <= 0 && isActive) {
      onCompleteRef.current();
    }
  }, [timeRemaining, isActive]);

  useEffect(() => {
    if (!isActive) return;
    if (prefersReducedMotion || hasTriggeredWarningHapticRef.current) return;
    if (timeRemaining > 0 && timeRemaining <= HURRY_ANNOUNCE_THRESHOLD_SECONDS) {
      hasTriggeredWarningHapticRef.current = true;
      triggerHaptic('urgency');
    }
  }, [timeRemaining, isActive, prefersReducedMotion]);

  // A jump upward in `timeRemaining` (vs. the previous tick) signals a new
  // question/round has started with a fresh timer instance — reset the
  // one-time "hurry up" announcement so it can fire again for this round.
  useEffect(() => {
    if (timeRemaining > prevTimeRemainingRef.current) {
      hasAnnouncedHurryRef.current = false;
      hasTriggeredWarningHapticRef.current = false;
    }
    prevTimeRemainingRef.current = timeRemaining;

    if (
      isActive &&
      !hasAnnouncedHurryRef.current &&
      timeRemaining > 0 &&
      timeRemaining <= HURRY_ANNOUNCE_THRESHOLD_SECONDS
    ) {
      hasAnnouncedHurryRef.current = true;
      setHurryAnnouncement(t('a11y.hurryUp', { seconds: timeRemaining }));
    }
  }, [timeRemaining, isActive, t]);

  const percentage = (timeRemaining / duration) * 100;
  const strokeDashoffset = 283 - (283 * percentage) / 100;
  const timerColor = getTimerColorToken(percentage);

  const isUrgent = timeRemaining > 0 && timeRemaining <= URGENCY_THRESHOLD_SECONDS && isActive;

  return (
    <div
      className={`relative ${compact ? 'h-11 w-11 sm:h-12 sm:w-12' : 'h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20'} ${isUrgent && !prefersReducedMotion ? 'timer-urgent' : ''}`}
      role="timer"
      aria-live="off"
      aria-label={t('game.timeRemaining', { seconds: Math.max(0, timeRemaining) })}
    >
      <svg className={`${compact ? 'h-11 w-11 sm:h-12 sm:w-12' : 'h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20'} -rotate-90 transform`} viewBox="0 0 100 100">
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
          className={`shadow-glow-primary ${prefersReducedMotion ? '' : 'transition-all duration-1000 ease-linear'}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`${compact ? 'text-sm sm:text-base' : 'text-lg sm:text-xl md:text-2xl'} font-bold ${prefersReducedMotion ? '' : 'transition-colors duration-300'}`}
          style={{ color: timerColor }}
        >
          {Math.max(0, timeRemaining)}{compact ? '' : 's'}
        </span>
      </div>
      <span className="sr-only" aria-live="polite">
        {hurryAnnouncement}
      </span>
    </div>
  );
}
