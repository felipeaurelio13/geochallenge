import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GamePage } from '../pages/GamePage';

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  startGameMock: vi.fn().mockResolvedValue(undefined),
  submitAnswerMock: vi.fn().mockResolvedValue({ isCorrect: true }),
  nextQuestionMock: vi.fn(),
  finishGameMock: vi.fn().mockResolvedValue(undefined),
  resetGameMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigateMock,
  useSearchParams: () => [new URLSearchParams('category=MIXED')],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    state: {
      questions: [
        {
          id: 'q1',
          questionText: 'Capital de Chile',
          options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
          correctAnswer: 'Santiago',
          category: 'CAPITAL',
        },
      ],
      currentIndex: 0,
      score: 100,
      results: [{ isCorrect: true }],
      status: 'playing',
    },
    startGame: mocks.startGameMock,
    submitAnswer: mocks.submitAnswerMock,
    nextQuestion: mocks.nextQuestionMock,
    finishGame: mocks.finishGameMock,
    resetGame: mocks.resetGameMock,
  }),
}));

vi.mock('../components', () => ({
  Timer: () => <div>timer</div>,
  QuestionCard: () => <div>question-card</div>,
  OptionButton: ({ option, onClick }: { option: string; onClick: () => void }) => (
    <button onClick={onClick}>{option}</button>
  ),
  ScoreDisplay: () => <div>score</div>,
  ProgressBar: () => <div>progress</div>,
  LoadingSpinner: ({ text }: { text?: string }) => <div>{text || 'loading'}</div>,
  AnswerStatusBadge: ({ label }: { label: string }) => <div>{label}</div>,
}));

describe('GamePage ending flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza alternativas en grilla de dos columnas para reducir scroll en mobile', () => {
    render(<GamePage />);

    const firstOption = screen.getByRole('button', { name: 'Santiago' });
    const optionsGrid = firstOption.parentElement;

    expect(optionsGrid).toHaveClass('grid');
    expect(optionsGrid).toHaveClass('grid-cols-2');
  });

  it('mantiene el estado hasta resultados sin resetear el juego al desmontar', async () => {
    const { unmount } = render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    const seeResultsButton = await screen.findByRole('button', { name: 'game.seeResults' });
    fireEvent.click(seeResultsButton);

    await waitFor(() => {
      expect(mocks.finishGameMock).toHaveBeenCalledTimes(1);
      expect(mocks.navigateMock).toHaveBeenCalledWith('/results');
    });

    unmount();

    expect(mocks.resetGameMock).not.toHaveBeenCalled();
  });
});
