import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyChallengePage } from '../pages/DailyChallengePage';

const navigateMock = vi.hoisted(() => vi.fn());
const getDailyMock = vi.hoisted(() => vi.fn());
const dailyAnswerMock = vi.hoisted(() => vi.fn());
const submitDailyMock = vi.hoisted(() => vi.fn());
const trackUxEventMock = vi.hoisted(() => vi.fn());
const confirmMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es' },
  }),
}));

vi.mock('../services/api', () => ({
  api: {
    getDaily: getDailyMock,
    dailyAnswer: dailyAnswerMock,
    submitDaily: submitDailyMock,
  },
}));

vi.mock('../components', () => ({
  GameRoundScaffold: ({ header, actionTray, question, onOptionSelect, showResult }: any) => (
    <div>
      {header}
      <div data-testid="options">
        {question.options.map((opt: string) => (
          <button key={opt} onClick={() => onOptionSelect(opt)} disabled={showResult}>{opt}</button>
        ))}
      </div>
      {actionTray}
    </div>
  ),
  RoundActionTray: ({ showResult, canSubmit, submitLabel, nextLabel, onSubmit, onNext }: any) => (
    <div data-testid="action-tray">
      {!showResult && <button onClick={onSubmit} disabled={!canSubmit}>{submitLabel}</button>}
      {showResult && nextLabel && <button onClick={onNext}>{nextLabel}</button>}
    </div>
  ),
  ProgressBar: () => <div>progress</div>,
  ScoreDisplay: () => <div>score</div>,
  Timer: () => <div>timer</div>,
  LoadingSpinner: ({ text }: { text?: string }) => <div>{text || 'loading'}</div>,
  Button: ({ onClick, children }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  MonumentAttribution: () => null,
}));

vi.mock('../utils/uxTelemetry', () => ({
  trackUxEvent: trackUxEventMock,
}));

vi.mock('../utils/funFacts', () => ({
  generateFunFact: () => null,
}));

vi.mock('../utils/questionTiming', () => ({
  applyExtendedTime: (duration: number) => duration,
  getQuestionDuration: () => 20,
}));

vi.mock('../hooks/useStreakShareImage', () => ({
  useStreakShareImage: () => ({ share: vi.fn(), status: 'idle' }),
}));

vi.mock('../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: confirmMock,
    confirmDialog: null,
  }),
}));

vi.mock('../store/useUiStore', () => ({
  useUiStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ extendedTimeEnabled: false, prefersReducedMotion: false }),
}));

const dailyQuestion = {
  id: 'dq1',
  questionText: 'Capital de Francia',
  options: ['París', 'Londres', 'Berlín', 'Madrid'],
  correctAnswer: 'París',
  category: 'CAPITAL',
};

describe('DailyChallengePage abandonment guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDailyMock.mockResolvedValue({ questions: [dailyQuestion] });
    dailyAnswerMock.mockResolvedValue({ isCorrect: true, correctAnswer: 'París' });
    submitDailyMock.mockResolvedValue({ result: { score: 100, correctCount: 1, totalQuestions: 1, playedAt: '2024-01-01T00:00:00Z' } });
    confirmMock.mockResolvedValue(true);
  });

  function abandonCallCount() {
    return trackUxEventMock.mock.calls.filter(
      (call: unknown[]) => call[0] === 'game_abandoned'
    ).length;
  }

  it('exit click + unmount: fires exactly 1 game_abandoned', async () => {
    const { unmount } = render(<DailyChallengePage />);

    await screen.findByRole('button', { name: 'game.exit' });

    fireEvent.click(screen.getByRole('button', { name: 'game.exit' }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/menu');
    });

    unmount();

    expect(abandonCallCount()).toBe(1);
  });

  it('finish + unmount: fires 0 game_abandoned', async () => {
    const { unmount } = render(<DailyChallengePage />);

    await screen.findByRole('button', { name: 'game.exit' });

    fireEvent.click(screen.getByRole('button', { name: 'París' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    const finishButton = await screen.findByRole('button', { name: 'daily.finish' });
    fireEvent.click(finishButton);

    await waitFor(() => {
      expect(submitDailyMock).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(abandonCallCount()).toBe(0);
  });

  it('unmount during game: fires exactly 1 game_abandoned', async () => {
    const { unmount } = render(<DailyChallengePage />);

    await screen.findByRole('button', { name: 'game.exit' });

    unmount();

    expect(abandonCallCount()).toBe(1);
  });
});
