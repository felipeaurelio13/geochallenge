import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GamePage } from '../pages/GamePage';

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  startGameMock: vi.fn().mockResolvedValue(undefined),
  submitAnswerMock: vi.fn(),
  nextQuestionMock: vi.fn(),
  finishGameMock: vi.fn().mockResolvedValue(undefined),
  useMechanicMock: vi.fn(),
  pushToastMock: vi.fn(),
  gameState: {} as Record<string, unknown>,
}));

const confirmDialogStable = vi.hoisted(() => ({
  confirm: vi.fn().mockResolvedValue(true),
  confirmDialog: null,
  isOpen: false,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigateMock,
  useSearchParams: () => [new URLSearchParams('category=CAPITAL')],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}));

vi.mock('../services/api', () => ({
  api: { useMechanic: (...args: unknown[]) => mocks.useMechanicMock(...args) },
}));

vi.mock('../store/useUiStore', () => ({
  useUiStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ prefersReducedMotion: true, extendedTimeEnabled: false }),
  uiStoreActions: { pushToast: (...args: unknown[]) => mocks.pushToastMock(...args) },
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    state: mocks.gameState,
    startGame: mocks.startGameMock,
    startPractice: vi.fn(),
    appendQuestions: vi.fn(),
    setStreakAlive: vi.fn(),
    submitAnswer: mocks.submitAnswerMock,
    nextQuestion: mocks.nextQuestionMock,
    finishGame: mocks.finishGameMock,
    resetGame: vi.fn(),
    setTimeRemaining: vi.fn(),
    replaceCurrentQuestion: vi.fn(),
  }),
}));

vi.mock('../utils/uxTelemetry', () => ({ trackUxEvent: vi.fn() }));

vi.mock('../hooks', async () => {
  const actual = await vi.importActual<typeof import('../hooks')>('../hooks');
  return { ...actual, useConfirmDialog: () => confirmDialogStable };
});

vi.mock('../components/MapInteractive', () => ({
  MapInteractive: ({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) => (
    <button onClick={() => onLocationSelect(10, 20)}>pick-location</button>
  ),
}));

vi.mock('../components/MonumentAttribution', () => ({ MonumentAttribution: () => null }));

vi.mock('../components', () => ({
  Timer: () => <div>timer</div>,
  ScoreDisplay: () => <div>score</div>,
  ProgressBar: () => <div>progress</div>,
  LoadingSpinner: () => <div>loading</div>,
  StreakCombo: () => <div>streak</div>,
  MechanicsHud: ({ disabled, onUseIntel5050 }: { disabled: boolean; onUseIntel5050: () => void }) => (
    <button data-disabled={disabled ? 'true' : 'false'} onClick={onUseIntel5050}>
      use-intel
    </button>
  ),
  RoundActionTray: ({ showResult, canSubmit, submitLabel, nextLabel, onSubmit, onNext, summarySlot }: any) => (
    <div>
      {summarySlot}
      {!showResult && <button onClick={onSubmit} disabled={!canSubmit}>{submitLabel}</button>}
      {showResult && <button onClick={onNext}>{nextLabel}</button>}
    </div>
  ),
  GameRoundScaffold: ({ header, actionTray, mapContent, isMapQuestion, question, onOptionSelect }: any) => (
    <div>
      {header}
      {isMapQuestion ? mapContent : question.options.map((option: string) => (
        <button key={option} onClick={() => onOptionSelect(option)}>{option}</button>
      ))}
      {actionTray}
    </div>
  ),
}));

const capitalQuestions = [
  { id: 'q1', options: ['Santiago', 'Lima', 'Bogotá', 'Quito'], category: 'CAPITAL' },
  { id: 'q2', options: ['Santiago', 'Lima', 'Bogotá', 'Quito'], category: 'CAPITAL' },
];

function setGameState(questions: unknown[], mechanics = false) {
  Object.assign(mocks.gameState, {
    questions,
    currentIndex: 0,
    score: 0,
    results: [],
    status: 'playing',
    config: {
      sessionId: 's1',
      timePerQuestion: 10,
      mechanics: mechanics
        ? { enabled: true, allowed: ['intel5050'], limits: { intel5050: 1, focusTime: 1 } }
        : { enabled: false, allowed: [], limits: {} },
    },
  });
}

describe('GamePage keyboard shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmDialogStable.isOpen = false;
    mocks.submitAnswerMock.mockResolvedValue({ isCorrect: true });
    setGameState(capitalQuestions);
  });

  it('selects with 1-4, submits with Enter, then advances with N', async () => {
    render(<GamePage />);

    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() => expect(mocks.submitAnswerMock).toHaveBeenCalledWith('Lima', undefined, undefined));
    await screen.findByRole('button', { name: 'game.next' });

    fireEvent.keyDown(window, { key: 'n' });
    await waitFor(() => expect(mocks.nextQuestionMock).toHaveBeenCalledTimes(1));
  });

  it('does not submit with Enter while nothing is selected', () => {
    render(<GamePage />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mocks.submitAnswerMock).not.toHaveBeenCalled();
  });

  it('ignores Cmd+D instead of picking an option', () => {
    render(<GamePage />);
    fireEvent.keyDown(window, { key: 'd', metaKey: true });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mocks.submitAnswerMock).not.toHaveBeenCalled();
  });

  it('is disabled while the confirm dialog is open', () => {
    confirmDialogStable.isOpen = true;
    render(<GamePage />);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mocks.submitAnswerMock).not.toHaveBeenCalled();
  });

  it('lets Enter advance after a MAP result', async () => {
    setGameState([
      { id: 'm1', options: [], category: 'MAP' },
      { id: 'm2', options: [], category: 'MAP' },
    ]);
    render(<GamePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'pick-location' }));
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(mocks.submitAnswerMock).toHaveBeenCalledWith('10,20', { lat: 10, lng: 20 }, undefined));
    await screen.findByRole('button', { name: 'game.next' });

    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(mocks.nextQuestionMock).toHaveBeenCalledTimes(1));
  });
});

describe('GamePage mechanics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmDialogStable.isOpen = false;
    setGameState(capitalQuestions, true);
  });

  it('shows a toast when using a mechanic fails', async () => {
    mocks.useMechanicMock.mockRejectedValueOnce(new Error('boom'));
    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'use-intel' }));

    await waitFor(() =>
      expect(mocks.pushToastMock).toHaveBeenCalledWith({ type: 'info', message: 'mechanics.useFailed' })
    );
    expect(screen.getByRole('button', { name: 'use-intel' })).toHaveAttribute('data-disabled', 'false');
  });

  it('guards against double clicks while a mechanic request is in flight', async () => {
    let resolve!: (value: { hiddenOptionIndexes: number[]; remaining: number }) => void;
    mocks.useMechanicMock.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    render(<GamePage />);

    const button = screen.getByRole('button', { name: 'use-intel' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mocks.useMechanicMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(button).toHaveAttribute('data-disabled', 'true'));

    await act(async () => {
      resolve({ hiddenOptionIndexes: [1, 2], remaining: 0 });
    });
    await waitFor(() => expect(button).toHaveAttribute('data-disabled', 'false'));
    expect(mocks.pushToastMock).not.toHaveBeenCalled();
  });
});
