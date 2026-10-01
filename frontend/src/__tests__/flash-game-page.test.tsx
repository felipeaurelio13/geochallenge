import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlashGamePage } from '../pages/FlashGamePage';

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  startFlashGame: vi.fn(),
  submitAnswer: vi.fn(),
  finishGame: vi.fn(),
  notifyQuestionStarted: vi.fn(),
  searchParams: new URLSearchParams('category=FLAG'),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigateMock,
  useSearchParams: () => [mocks.searchParams],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && typeof opts.label === 'string' ? `${key}:${opts.label}` : key,
    i18n: { language: 'es' },
  }),
}));

vi.mock('../services/api', () => ({
  api: {
    startFlashGame: (...args: unknown[]) => mocks.startFlashGame(...args),
    submitAnswer: (...args: unknown[]) => mocks.submitAnswer(...args),
    finishGame: (...args: unknown[]) => mocks.finishGame(...args),
    notifyQuestionStarted: (...args: unknown[]) => mocks.notifyQuestionStarted(...args),
    useMechanic: vi.fn(),
  },
}));

const questions = [
  { id: 'q1', category: 'CAPITAL', questionText: 'Q1', options: ['Santiago', 'Lima'], correctAnswer: 'Santiago' },
  { id: 'q2', category: 'CAPITAL', questionText: 'Q2', options: ['Quito', 'Bogotá'], correctAnswer: 'Quito' },
];

async function startRound() {
  render(<FlashGamePage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  fireEvent.click(screen.getByText('flash.start'));
}

describe('FlashGamePage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.startFlashGame.mockResolvedValue({
      sessionId: 's1',
      questions,
      gameConfig: { durationSeconds: 10 },
    });
    mocks.finishGame.mockResolvedValue({ totalScore: 42 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('submits only once when the player double taps while the request is in flight', async () => {
    let resolveSubmit: (v: unknown) => void = () => {};
    mocks.submitAnswer.mockImplementation(() => new Promise((resolve) => { resolveSubmit = resolve; }));
    await startRound();

    const option = screen.getByLabelText('flash.optionA:Santiago');
    fireEvent.click(option);
    fireEvent.click(option);
    expect(mocks.submitAnswer).toHaveBeenCalledTimes(1);

    await act(async () => { resolveSubmit({ isCorrect: true, points: 10, correctAnswer: 'Santiago' }); });
    fireEvent.click(screen.getByLabelText('flash.optionA:Santiago'));
    expect(mocks.submitAnswer).toHaveBeenCalledTimes(1);
  });

  it('highlights the correct option on a miss and holds feedback longer than on a hit', async () => {
    mocks.submitAnswer.mockResolvedValue({ isCorrect: false, points: 0, correctAnswer: 'Santiago' });
    await startRound();

    await act(async () => { fireEvent.click(screen.getByLabelText('flash.optionB:Lima')); });
    expect(screen.getByLabelText('flash.optionA:Santiago')).toHaveAttribute('data-correct', 'true');
    expect(screen.getByLabelText('flash.optionB:Lima')).not.toHaveAttribute('data-correct');

    await act(async () => { await vi.advanceTimersByTimeAsync(320); });
    expect(screen.queryByLabelText('flash.optionA:Quito')).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.getByLabelText('flash.optionA:Quito')).toBeInTheDocument();
  });

  it('advances after 320ms on a correct answer', async () => {
    mocks.submitAnswer.mockResolvedValue({ isCorrect: true, points: 10, correctAnswer: 'Santiago' });
    await startRound();

    await act(async () => { fireEvent.click(screen.getByLabelText('flash.optionA:Santiago')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(320); });
    expect(screen.getByLabelText('flash.optionA:Quito')).toBeInTheDocument();
  });

  it('shows a retry button when finishing fails and recovers on retry', async () => {
    mocks.finishGame.mockRejectedValueOnce(new Error('offline'));
    await startRound();

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByText('flash.finishError')).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByText('flash.finishRetry')); });
    expect(mocks.finishGame).toHaveBeenCalledTimes(2);
    expect(screen.getByText('flash.finished')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('registers a beforeunload guard only while the round is playing', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    await startRound();
    expect(addSpy.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true);

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    addSpy.mockRestore();
  });
});
