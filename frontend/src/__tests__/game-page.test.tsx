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
  gameState: {
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
    state: mocks.gameState,
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
    mocks.gameState.questions = [
      {
        id: 'q1',
        questionText: 'Capital de Chile',
        options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
        correctAnswer: 'Santiago',
        category: 'CAPITAL',
      },
    ];
  });

  it('renderiza alternativas en grilla de dos columnas para reducir scroll en mobile', () => {
    render(<GamePage />);

    const firstOption = screen.getByRole('button', { name: 'Santiago' });
    const optionsGrid = firstOption.parentElement;

    expect(optionsGrid).toHaveClass('grid');
    expect(optionsGrid).toHaveClass('grid-cols-2');
  });

  it('prioriza una columna en mobile para categoría banderas y mejora legibilidad', () => {
    mocks.gameState.questions = [
      {
        id: 'q2',
        questionText: 'Bandera de Japón',
        options: ['Japón', 'Corea del Sur', 'China', 'Vietnam'],
        correctAnswer: 'Japón',
        category: 'FLAG',
      },
    ];

    render(<GamePage />);

    const firstOption = screen.getByRole('button', { name: 'Japón' });
    const optionsGrid = firstOption.parentElement;

    expect(optionsGrid).toHaveClass('grid');
    expect(optionsGrid).toHaveClass('grid-cols-1');
    expect(optionsGrid).toHaveClass('sm:grid-cols-2');
  });




  it('mantiene bandeja de acciones fija en mobile con espacio inferior seguro', () => {
    render(<GamePage />);

    const main = screen.getByRole('main');
    expect(main).toHaveClass('pb-32');

    const tray = screen.getByTestId('mobile-action-tray');
    expect(tray).toHaveClass('sticky');
    expect(tray).toHaveClass('bottom-0');
  });

  it('muestra guía contextual antes de seleccionar y permite limpiar selección', () => {
    render(<GamePage />);

    expect(screen.getByText('game.selectOptionHint')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'game.clearSelection' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));

    expect(screen.getByText('game.selectionReadyHint')).toBeInTheDocument();

    const clearButton = screen.getByRole('button', { name: 'game.clearSelection' });
    fireEvent.click(clearButton);

    expect(screen.getByText('game.selectOptionHint')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'game.clearSelection' })).not.toBeInTheDocument();
  });

  it('mantiene el botón Confirmar deshabilitado hasta elegir una alternativa', () => {
    render(<GamePage />);

    const submitButton = screen.getByRole('button', { name: 'game.submit' });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    expect(submitButton).toBeEnabled();
  });

  it('oculta la guía contextual al mostrar resultado para evitar mensajes duplicados', async () => {
    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    await screen.findByText('game.correct');

    expect(screen.queryByText('game.selectionReadyHint')).not.toBeInTheDocument();
    expect(screen.queryByText('game.selectOptionHint')).not.toBeInTheDocument();
  });

  it('mantiene el estado hasta resultados sin resetear el juego al desmontar', async () => {
    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    const seeResultsButton = await screen.findByRole('button', { name: 'game.seeResults' });
    fireEvent.click(seeResultsButton);

    await waitFor(() => {
      expect(mocks.finishGameMock).toHaveBeenCalledTimes(1);
      expect(mocks.navigateMock).toHaveBeenCalledWith('/results');
    });

    expect(mocks.resetGameMock).not.toHaveBeenCalled();
  });
});
