import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GamePage } from '../pages/GamePage';

let mockedSearchParams = 'category=MIXED';

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  startGameMock: vi.fn().mockResolvedValue(undefined),
  submitAnswerMock: vi.fn().mockResolvedValue({ isCorrect: true }),
  nextQuestionMock: vi.fn(),
  finishGameMock: vi.fn().mockResolvedValue(undefined),
  resetGameMock: vi.fn(),
  appendQuestionsMock: vi.fn(),
  setStreakAliveMock: vi.fn(),
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
  useSearchParams: () => [new URLSearchParams(mockedSearchParams)],
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
    appendQuestions: mocks.appendQuestionsMock,
    setStreakAlive: mocks.setStreakAliveMock,
    submitAnswer: mocks.submitAnswerMock,
    nextQuestion: mocks.nextQuestionMock,
    finishGame: mocks.finishGameMock,
    resetGame: mocks.resetGameMock,
  }),
}));

vi.mock('../components', () => ({
  Timer: () => <div>timer</div>,
  QuestionCard: ({ compact }: { compact?: boolean }) => (
    <div data-testid="question-card" data-compact={compact ? 'true' : 'false'}>question-card</div>
  ),
  OptionButton: ({ option, onClick }: { option: string; onClick: () => void }) => (
    <button onClick={onClick}>{option}</button>
  ),
  ScoreDisplay: ({ score }: { score: number }) => <div>{`score:${score}`}</div>,
  ProgressBar: () => <div>progress</div>,
  LoadingSpinner: ({ text }: { text?: string }) => <div>{text || 'loading'}</div>,
  RoundActionTray: ({ showResult, canSubmit, submitLabel, nextLabel, onSubmit, onNext, resultLabel }: any) => (
    <div data-testid="mobile-action-tray" className="fixed bottom-0">
      {!showResult && <button onClick={onSubmit} disabled={!canSubmit}>{submitLabel}</button>}
      {showResult && nextLabel && <button onClick={onNext}>{nextLabel}</button>}
      {showResult && resultLabel && <p>{resultLabel}</p>}
    </div>
  ),
  GameRoundScaffold: ({ header, progress, actionTray, mapContent, isMapQuestion, question, onOptionSelect, showResult, disableOptions, optionsGridClassName, rootClassName = 'universal-layout bg-gray-900' }: any) => (
    <div className={rootClassName}>
      {header}
      {progress}
      <main role="main" className="content-area">
        <div data-testid="question-card" data-compact="true">question-card</div>
        {isMapQuestion ? mapContent : (
          <div className={optionsGridClassName}>
            {question.options.map((option: string) => (
              <button key={option} onClick={() => onOptionSelect(option)} disabled={showResult || disableOptions}>{option}</button>
            ))}
          </div>
        )}
      </main>
      {actionTray}
    </div>
  ),
}));

describe('GamePage ending flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSearchParams = 'category=MIXED';
    mocks.gameState.questions = [
      {
        id: 'q1',
        questionText: 'Capital de Chile',
        options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
        correctAnswer: 'Santiago',
        category: 'CAPITAL',
      },
    ];
    mocks.gameState.currentIndex = 0;
    mocks.gameState.score = 100;
    mocks.gameState.status = 'playing';
    mocks.submitAnswerMock.mockResolvedValue({ isCorrect: true });
  });

  it('renderiza alternativas en lista vertical 1x4 para layout universal', () => {
    render(<GamePage />);

    const firstOption = screen.getByRole('button', { name: 'Santiago' });
    const optionsGrid = firstOption.parentElement;

    expect(optionsGrid).toHaveClass('game-options-grid');
    expect(optionsGrid).not.toHaveClass('grid-cols-2');
  });

  it('mantiene lista vertical también para categoría banderas', () => {
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

    expect(optionsGrid).toHaveClass('game-options-grid');
    expect(optionsGrid).not.toHaveClass('grid-cols-2');
    expect(optionsGrid).not.toHaveClass('sm:grid-cols-2');
  });

  it('elimina la barra textual de pregunta para ganar espacio vertical', () => {
    render(<GamePage />);

    expect(screen.queryByText('game.questionOf')).not.toBeInTheDocument();
    expect(screen.getByText('progress')).toBeInTheDocument();
  });

  it('mantiene bandeja de acciones fija en mobile con espacio inferior seguro', () => {
    render(<GamePage />);

    const main = screen.getByRole('main');
    expect(main).toHaveClass('content-area');

    const tray = screen.getByTestId('mobile-action-tray');
    expect(tray).toHaveClass('fixed');
    expect(tray).toHaveClass('bottom-0');
  });


  it('aplica safe-area en header y separa el timer del borde derecho del sistema', () => {
    const { container } = render(<GamePage />);

    const header = container.querySelector('header');
    const timerWrapper = screen.getByText('timer').parentElement;

    expect(header).toHaveClass('pt-3');
    expect(timerWrapper).toHaveClass('pr-[max(env(safe-area-inset-right),0.5rem)]');
  });

  it('mantiene el botón Confirmar deshabilitado hasta elegir una alternativa', () => {
    render(<GamePage />);

    const submitButton = screen.getByRole('button', { name: 'game.submit' });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    expect(submitButton).toBeEnabled();
  });

  it('muestra resultado y permite avanzar al finalizar', async () => {
    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    await screen.findByText('game.correct');

    const seeResultsButton = await screen.findByRole('button', { name: 'game.seeResults' });
    fireEvent.click(seeResultsButton);

    await waitFor(() => {
      expect(mocks.finishGameMock).toHaveBeenCalledTimes(1);
      expect(mocks.navigateMock).toHaveBeenCalledWith('/results');
    });
  });

  it('en modo streak con acierto sigue a la siguiente ronda', async () => {
    mockedSearchParams = 'category=CAPITAL&mode=streak';
    mocks.gameState.questions = [
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
    ];
    mocks.submitAnswerMock.mockResolvedValue({ isCorrect: true });

    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));
    await screen.findByText('game.correct');

    fireEvent.click(screen.getByRole('button', { name: 'game.next' }));

    await waitFor(() => {
      expect(mocks.nextQuestionMock).toHaveBeenCalledTimes(1);
    });
    expect(mocks.finishGameMock).not.toHaveBeenCalled();
    expect(mocks.navigateMock).not.toHaveBeenCalledWith('/results?gameType=streak');
  });

  it('en modo streak con fallo termina la partida y navega a resultados', async () => {
    mockedSearchParams = 'category=CAPITAL&mode=streak';
    mocks.submitAnswerMock.mockResolvedValue({ isCorrect: false });

    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    await waitFor(() => {
      expect(mocks.finishGameMock).toHaveBeenCalledTimes(1);
      expect(mocks.navigateMock).toHaveBeenCalledWith('/results?gameType=streak');
    });
    expect(mocks.nextQuestionMock).not.toHaveBeenCalled();
  });

  it('incrementa el score de 1 en 1 cuando hay aciertos en streak', async () => {
    mockedSearchParams = 'category=CAPITAL&mode=streak';
    mocks.gameState.score = 0;
    mocks.submitAnswerMock.mockImplementation(async () => {
      mocks.gameState.score += 1;
      return { isCorrect: true };
    });

    render(<GamePage />);

    expect(screen.getByText('score:0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));
    await screen.findByText('game.correct');
    expect(screen.getByText('score:1')).toBeInTheDocument();
  });
});
