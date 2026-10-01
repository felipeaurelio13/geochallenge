import { useState } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timer } from '../components/Timer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}));

vi.mock('../hooks/useHaptics', () => ({ triggerHaptic: vi.fn() }));

function Harness({
  initial = 10,
  isActive = true,
  onTickSpy,
  onCompleteSpy,
}: {
  initial?: number;
  isActive?: boolean;
  onTickSpy?: (t: number) => void;
  onCompleteSpy?: () => void;
}) {
  const [time, setTime] = useState(initial);
  return (
    <>
      <button data-testid="reset" onClick={() => setTime(initial)} />
      <Timer
        duration={initial}
        timeRemaining={time}
        onTick={(next) => {
          onTickSpy?.(next);
          setTime(next);
        }}
        onComplete={() => onCompleteSpy?.()}
        isActive={isActive}
      />
    </>
  );
}

const remaining = (container: HTMLElement) => container.querySelector('[role="timer"] span')?.textContent;

describe('Timer wall-clock behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down one second per elapsed second', () => {
    const { container } = render(<Harness />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(remaining(container)).toBe('7s');
  });

  it('recovers elapsed time after throttling when the tab becomes visible again', () => {
    const onTick = vi.fn();
    const { container } = render(<Harness onTickSpy={onTick} />);
    // Simulate a throttled tab: wall clock moves 6s but no interval callback ran.
    act(() => {
      vi.setSystemTime(Date.now() + 6000);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(onTick).toHaveBeenLastCalledWith(4);
    expect(remaining(container)).toBe('4s');
  });

  it('calls onComplete once when the deadline passes', () => {
    const onComplete = vi.fn();
    const { container } = render(<Harness initial={2} onCompleteSpy={onComplete} />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(remaining(container)).toBe('0s');
    expect(onComplete).toHaveBeenCalled();
  });

  it('freezes while paused and resumes from the frozen remaining time', () => {
    const { container, rerender } = render(<Harness isActive />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(remaining(container)).toBe('7s');

    rerender(<Harness isActive={false} />);
    act(() => { vi.advanceTimersByTime(20000); });
    expect(remaining(container)).toBe('7s');

    rerender(<Harness isActive />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(remaining(container)).toBe('5s');
  });

  it('restarts the deadline when the parent resets timeRemaining', () => {
    const { container, getByTestId } = render(<Harness />);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(remaining(container)).toBe('6s');
    act(() => { getByTestId('reset').click(); });
    expect(remaining(container)).toBe('10s');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(remaining(container)).toBe('9s');
  });
});
