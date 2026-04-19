import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GamePage } from '../pages/GamePage';

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  searchParams: new URLSearchParams('category=MIXED&gameType=streak'),
  startGameMock: vi.fn().mockResolvedValue(undefined),
  appendQuestionsMock: vi.fn(),
  setStreakAliveMock: vi.fn(),
  submitAnswerMock: vi.fn().mockResolvedValue({ isCorrect: true, points: 100 }),
  nextQuestionMock: vi.fn(),
  finishGameMock: vi.fn().mockResolvedValue(undefined),
  resetGameMock: vi.fn(),
  setTimeRemainingMock: vi.fn(),
  apiStartGameMock: vi.fn().mockResolvedValue({
    questions: [{
      id: 'q-extra',
      questionText: 'Extra',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      category: 'CAPITAL',
    }],
    gameConfig: {
      questionsCount: 10,
      timePerQuestion: 10,
      category: 'MIXED',
      gameType: 'streak',
    },
  }),
  gameState: {
    questions: [
      {
        id: 'q1',
        questionText: 'Capital de Chile',
        options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
        correctAnswer: 'Santiago',
        category: 'CAPITAL',
      },
      {
        id: 'q2',
        questionText: 'Capital de Perú',
        options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
        correctAnswer: 'Lima',
        category: 'CAPITAL',
      },
      {
        id: 'q3',
        questionText: 'Capital de Ecuador',
        options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
        correctAnswer: 'Quito',
        category: 'CAPITAL',
      },
    ],
    currentIndex: 0,
    score: 100,
    results: [],
    status: 'playing',
    config: null,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigateMock,
  useSearchParams: () => [mocks.searchParams],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../services/api', () => ({
  api: {
    startGame: (...args: unknown[]) => mocks.apiStartGameMock(...args),
  },
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    state: mocks.gameState,
    startGame: mocks.startGameMock,
    appendQuestions: mocks.appendQuestionsMock,
    setStreakAlive: mocks.setStreakAliveMock,
    submitAnswer: mocks.submitAnswerMock,
    nextQuestion: mocks.nextQuestionMock,
    finishGame: mocks.finishGameMock,
    resetGame: mocks.resetGameMock,
    setTimeRemaining: mocks.setTimeRemainingMock,
  }),
}));

vi.mock('../components', () => ({
  Timer: () => <div>timer</div>,
  ScoreDisplay: () => <div>score</div>,
  ProgressBar: () => <div>progress</div>,
  LoadingSpinner: ({ text }: { text?: string }) => <div>{text || 'loading'}</div>,
  MechanicsHud: () => <div>mechanics-hud</div>,
  RoundActionTray: ({ showResult, canSubmit, submitLabel, nextLabel, onSubmit, onNext }: any) => (
    <div data-testid="mobile-action-tray">
      {!showResult && <button onClick={onSubmit} disabled={!canSubmit}>{submitLabel}</button>}
      {showResult && nextLabel && <button onClick={onNext}>{nextLabel}</button>}
    </div>
  ),
  GameRoundScaffold: ({ header, progress, actionTray, question, onOptionSelect, showResult, disableOptions, optionsGridClassName }: any) => (
    <div>
      {header}
      {progress}
      <div className={optionsGridClassName}>
        {question.options.map((option: string) => (
          <button key={option} onClick={() => onOptionSelect(option)} disabled={showResult || disableOptions}>{option}</button>
        ))}
      </div>
      {actionTray}
    </div>
  ),
}));

describe('GamePage streak mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchParams = new URLSearchParams('category=MIXED&gameType=streak');
    mocks.gameState.currentIndex = 0;
    mocks.gameState.questions = mocks.gameState.questions.slice(0, 3);
    mocks.gameState.config = null;
  });

  it('inicia juego usando gameType=streak', async () => {
    render(<GamePage />);

    await waitFor(() => {
      expect(mocks.startGameMock).toHaveBeenCalledWith('MIXED', undefined, 'streak');
    });
  });

  it('acepta mode=streak como fallback de compatibilidad en query params', async () => {
    mocks.searchParams = new URLSearchParams('category=MAP&mode=streak');

    render(<GamePage />);

    await waitFor(() => {
      expect(mocks.startGameMock).toHaveBeenCalledWith('MAP', undefined, 'streak');
    });
  });

  it('finaliza inmediatamente al fallar en racha y navega a resultados de racha', async () => {
    mocks.submitAnswerMock.mockResolvedValueOnce({ isCorrect: false, points: 0 });

    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    await waitFor(() => {
      expect(mocks.setStreakAliveMock).toHaveBeenCalledWith(false);
      expect(mocks.finishGameMock).toHaveBeenCalledTimes(1);
      expect(mocks.navigateMock).toHaveBeenCalledWith('/results?gameType=streak');
    });
  });

  it('prefetch de preguntas cuando el buffer de racha es bajo', async () => {
    mocks.gameState.currentIndex = 1;

    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Lima' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    const nextButton = await screen.findByRole('button', { name: 'game.next' });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mocks.apiStartGameMock).toHaveBeenCalledWith(
        'MIXED',
        10,
        'streak',
        ['q1', 'q2', 'q3'],
        [
          'capital|||santiago',
          'capital|||lima',
          'capital|||quito',
        ]
      );
      expect(mocks.appendQuestionsMock).toHaveBeenCalled();
    });
  });

  it('en la última pregunta de racha continúa si llega un refill', async () => {
    mocks.gameState.currentIndex = 2;

    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Quito' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    const nextButton = await screen.findByRole('button', { name: 'game.next' });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mocks.apiStartGameMock).toHaveBeenCalledWith(
        'MIXED',
        10,
        'streak',
        ['q1', 'q2', 'q3'],
        [
          'capital|||santiago',
          'capital|||lima',
          'capital|||quito',
        ]
      );
      expect(mocks.appendQuestionsMock).toHaveBeenCalled();
      expect(mocks.nextQuestionMock).toHaveBeenCalledTimes(1);
      expect(mocks.navigateMock).not.toHaveBeenCalledWith('/results?gameType=streak');
    });
  });

  it('consume escudo de racha cuando está habilitado y evita terminar en el primer fallo', async () => {
    mocks.gameState.config = {
      questionsCount: 10,
      timePerQuestion: 10,
      category: 'MIXED',
      gameType: 'streak',
      mechanics: {
        enabled: true,
        allowed: ['streakShield'],
        limits: { streakShield: 1 },
      },
    };
    mocks.submitAnswerMock.mockResolvedValueOnce({ isCorrect: false, points: 0 });

    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    await waitFor(() => {
      expect(mocks.finishGameMock).not.toHaveBeenCalled();
      expect(mocks.navigateMock).not.toHaveBeenCalledWith('/results?gameType=streak');
    });
  });
});
