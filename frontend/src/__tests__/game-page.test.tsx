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
  QuestionCard: ({ compact }: { compact?: boolean }) => (
    <div data-testid="question-card" data-compact={compact ? 'true' : 'false'}>question-card</div>
  ),
  OptionButton: ({ option, onClick }: { option: string; onClick: () => void }) => (
    <button onClick={onClick}>{option}</button>
  ),
  ScoreDisplay: () => <div>score</div>,
  ProgressBar: () => <div>progress</div>,
  LoadingSpinner: ({ text }: { text?: string }) => <div>{text || 'loading'}</div>,
  RoundActionTray: ({ showResult, canSubmit, submitLabel, nextLabel, onSubmit, onNext, resultLabel }: any) => (
    <div data-testid="mobile-action-tray" className="fixed bottom-0">
      {!showResult && <button onClick={onSubmit} disabled={!canSubmit}>{submitLabel}</button>}
      {showResult && nextLabel && <button onClick={onNext}>{nextLabel}</button>}
      {showResult && resultLabel && <p>{resultLabel}</p>}
    </div>
  ),
  GameRoundScaffold: ({ header, progress, actionTray, mapContent, isMapQuestion, question, onOptionSelect, showResult, disableOptions, optionsGridClassName, rootClassName = 'h-full min-h-0 bg-gray-900 flex flex-col overflow-hidden', mainClassName = 'flex-1 min-h-0 overflow-hidden px-3 pt-1.5 pb-[6.35rem] sm:px-4 sm:pt-2 sm:pb-24' }: any) => (
    <div className={rootClassName}>
      {header}
      {progress}
      <main role="main" className={mainClassName}>
        <div data-testid="question-card" data-compact="true">question-card</div>
        {isMapQuestion ? mapContent : (
          <div className={optionsGridClassName}>
            {question.options.map((option: string) => (
              <button key={option} onClick={() => onOptionSelect(option)} disabled={showResult || disableOptions}>{option}</button>
            ))}
          </div>
        )}
        {actionTray}
      </main>
    </div>
  ),
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

  it('elimina la barra textual de pregunta para ganar espacio vertical', () => {
    render(<GamePage />);

    expect(screen.queryByText('game.questionOf')).not.toBeInTheDocument();
    expect(screen.getByText('progress')).toBeInTheDocument();
  });

  it('mantiene bandeja de acciones fija en mobile con espacio inferior seguro', () => {
    render(<GamePage />);

    const main = screen.getByRole('main');
    expect(main).toHaveClass('overflow-hidden');
    expect(main).toHaveClass('pb-[6.35rem]');

    const tray = screen.getByTestId('mobile-action-tray');
    expect(tray).toHaveClass('fixed');
    expect(tray).toHaveClass('bottom-0');
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
});
