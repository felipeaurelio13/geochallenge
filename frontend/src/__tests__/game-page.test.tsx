import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import axios from 'axios';
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
  setTimeRemainingMock: vi.fn(),
  appendQuestionsMock: vi.fn(),
  setStreakAliveMock: vi.fn(),
  apiStartGameMock: vi.fn().mockResolvedValue({
    questions: [],
    gameConfig: {
      questionsCount: 0,
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
    ],
    currentIndex: 0,
    score: 100,
    results: [{ isCorrect: true }],
    status: 'playing',
  },
}));

const uxMocks = vi.hoisted(() => ({
  trackUxEvent: vi.fn(),
}));

const confirmDialogStable = vi.hoisted(() => ({
  confirm: vi.fn().mockResolvedValue(true),
  confirmDialog: null,
  isOpen: false,
}));

const blockerMock = vi.hoisted(() => ({
  state: 'unblocked' as 'unblocked' | 'blocked',
  proceed: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigateMock,
  useSearchParams: () => {
    const params = React.useMemo(() => new URLSearchParams(mockedSearchParams), [mockedSearchParams]);
    return [params, vi.fn()];
  },
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useBlocker: () => blockerMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'game.confirmExitProgress') {
        return `game.confirmExitProgress:${options?.answered}/${options?.total}`;
      }
      return key;
    },
    i18n: { language: 'es' },
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

vi.mock('../utils/uxTelemetry', () => ({
  trackUxEvent: uxMocks.trackUxEvent,
}));

vi.mock('../hooks', async () => {
  const actual = await vi.importActual<typeof import('../hooks')>('../hooks');
  return {
    ...actual,
    useConfirmDialog: () => confirmDialogStable,
  };
});

vi.mock('../components', () => ({
  Timer: ({ isActive }: { isActive: boolean }) => <div data-testid="timer" data-active={isActive ? 'true' : 'false'}>timer</div>,
  QuestionCard: ({ compact }: { compact?: boolean }) => (
    <div data-testid="question-card" data-compact={compact ? 'true' : 'false'}>question-card</div>
  ),
  OptionButton: ({ option, onClick }: { option: string; onClick: () => void }) => (
    <button onClick={onClick}>{option}</button>
  ),
  ScoreDisplay: ({ score }: { score: number }) => <div>{`score:${score}`}</div>,
  ProgressBar: () => <div>progress</div>,
  LoadingSpinner: ({ text }: { text?: string }) => <div>{text || 'loading'}</div>,
  MechanicsHud: () => <div>mechanics-hud</div>,
  StreakCombo: ({ combo }: { combo: number }) => <div data-testid="streak-combo">streak {combo}</div>,
  RoundActionTray: ({ showResult, canSubmit, submitLabel, nextLabel, onSubmit, onNext, resultLabel, submitError, onRetrySubmit, retryLabel, nextButtonRef }: any) => (
    <div data-testid="mobile-action-tray" className="fixed bottom-0">
      {!showResult && submitError && (
        <div role="alert">
          <p>{submitError}</p>
          <button onClick={onRetrySubmit}>{retryLabel}</button>
        </div>
      )}
      {!showResult && !submitError && <button onClick={onSubmit} disabled={!canSubmit}>{submitLabel}</button>}
      {showResult && nextLabel && <button ref={nextButtonRef} onClick={onNext}>{nextLabel}</button>}
      {showResult && resultLabel && <p>{resultLabel}</p>}
    </div>
  ),
  GameRoundScaffold: ({ header, progress, actionTray, mapContent, isMapQuestion, question, onOptionSelect, showResult, disableOptions, optionsGridClassName, feedback, questionHeadingRef, shortcutHint, rootClassName = 'universal-layout bg-gray-900' }: any) => (
    <div className={rootClassName}>
      {header}
      {progress}
      <main role="main" className="content-area">
        <h2 key={question.id} ref={questionHeadingRef} tabIndex={-1} data-testid="question-heading">question-heading</h2>
        <div data-testid="question-card" data-compact="true">question-card</div>
        {shortcutHint && <p>{shortcutHint}</p>}
        {isMapQuestion ? mapContent : (
          <div className={optionsGridClassName}>
            {question.options.map((option: string) => (
              <button key={option} onClick={() => onOptionSelect(option)} disabled={showResult || disableOptions}>{option}</button>
            ))}
          </div>
        )}
        {feedback}
      </main>
      {actionTray}
    </div>
  ),
}));

describe('GamePage ending flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    blockerMock.state = 'unblocked';
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
    mocks.gameState.results = [{ isCorrect: true }];
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

  it('muestra la categoría de la ronda en el encabezado', () => {
    mocks.gameState.questions.push({
      id: 'q2',
      questionText: 'Capital de Perú',
      options: ['Lima', 'Bogotá', 'Quito', 'Santiago'],
      correctAnswer: 'Lima',
      category: 'CAPITAL',
    });

    render(<GamePage />);

    expect(screen.getByText(/categories\.capitals/)).toBeInTheDocument();
  });

  it('refleja el progreso de la ronda en el título de la pestaña y lo restaura al salir', () => {
    const { unmount } = render(<GamePage />);

    expect(document.title).toBe('game.tabProgress · app.name');

    unmount();
    expect(document.title).toBe('app.name');
  });

  it('usa el contador compacto en header y elimina progreso redundante en Single/Mixed', () => {
    render(<GamePage />);

    expect(screen.queryByText('game.questionOf')).not.toBeInTheDocument();
    expect(screen.queryByText('progress')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
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

    expect(header).toHaveClass('py-1.5');
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
      expect(mocks.navigateMock).toHaveBeenCalledWith('/results?category=MIXED&gameType=single');
    });
  });

  it('muestra la racha clásica desde el segundo acierto y la oculta al fallar', () => {
    mocks.gameState.results = [{ isCorrect: true }, { isCorrect: true }];
    const { rerender } = render(<GamePage />);

    const badge = screen.getByTestId('streak-combo');
    expect(badge).toHaveTextContent('streak 2');
    expect(badge.parentElement).toHaveClass('hidden');
    expect(badge.parentElement).toHaveClass('sm:flex');

    mocks.gameState.results = [{ isCorrect: true }, { isCorrect: true }, { isCorrect: false }];
    rerender(<GamePage />);

    expect(screen.queryByTestId('streak-combo')).not.toBeInTheDocument();
  });

  it('lleva el foco al enunciado y luego a la acción de la ronda', async () => {
    render(<GamePage />);

    const heading = screen.getByTestId('question-heading');
    await waitFor(() => expect(heading).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    const nextButton = await screen.findByRole('button', { name: 'game.seeResults' });
    await waitFor(() => expect(nextButton).toHaveFocus());
  });

  it('incluye el progreso real en la confirmación de salida', async () => {
    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'game.exit' }));

    await waitFor(() => {
      expect(confirmDialogStable.confirm).toHaveBeenCalledWith('game.confirmExitProgress:1/1');
    });
  });

  it('pide confirmación al abandonar con el botón atrás y reanuda si se cancela', async () => {
    blockerMock.state = 'blocked';
    confirmDialogStable.confirm.mockResolvedValueOnce(false);

    render(<GamePage />);

    await waitFor(() => {
      expect(confirmDialogStable.confirm).toHaveBeenCalledWith('game.confirmExitProgress:1/1');
    });
    await waitFor(() => expect(blockerMock.reset).toHaveBeenCalled());
    expect(blockerMock.proceed).not.toHaveBeenCalled();
    expect(mocks.resetGameMock).not.toHaveBeenCalled();
  });

  it('abandona y registra la salida si se confirma el botón atrás', async () => {
    blockerMock.state = 'blocked';

    render(<GamePage />);

    await waitFor(() => expect(blockerMock.proceed).toHaveBeenCalled());
    expect(mocks.resetGameMock).toHaveBeenCalled();
    expect(uxMocks.trackUxEvent).toHaveBeenCalledWith(
      'game_abandoned',
      expect.objectContaining({ reason: 'navigation' }),
    );
  });

  it('pausa el temporizador mientras el diálogo de salida está abierto', () => {
    confirmDialogStable.isOpen = true;
    try {
      render(<GamePage />);
      expect(screen.getByTestId('timer')).toHaveAttribute('data-active', 'false');
    } finally {
      confirmDialogStable.isOpen = false;
    }
  });

  it('no habla de progreso perdido si todavía no hay respuestas', async () => {
    mocks.gameState.results = [];
    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'game.exit' }));

    await waitFor(() => {
      expect(confirmDialogStable.confirm).toHaveBeenCalledWith('game.confirmExitEmpty');
    });
  });

  it('avisa solo cuando la pregunta actual es la última', () => {
    mocks.gameState.questions.push({
      id: 'q2',
      questionText: 'Capital de Perú',
      options: ['Lima', 'Bogotá', 'Quito', 'Santiago'],
      correctAnswer: 'Lima',
      category: 'CAPITAL',
    });
    const { rerender } = render(<GamePage />);

    expect(screen.queryByText(/game.lastQuestion/)).not.toBeInTheDocument();

    mocks.gameState.currentIndex = 1;
    rerender(<GamePage />);

    expect(screen.getByText(/game.lastQuestion/)).toBeInTheDocument();
    expect(screen.getByText(/categories\.capitals/)).toBeInTheDocument();
  });

  it('muestra la pista de atajos solo antes de la primera respuesta', async () => {
    render(<GamePage />);

    expect(screen.getByText('game.keyboardHint')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    await screen.findByText('game.correct');
    expect(screen.queryByText('game.keyboardHint')).not.toBeInTheDocument();
  });

  it('devuelve el foco al enunciado al cargar otra pregunta', async () => {
    mocks.gameState.questions.push({
      id: 'q2',
      questionText: 'Capital de Perú',
      options: ['Lima', 'Bogotá', 'Quito', 'Santiago'],
      correctAnswer: 'Lima',
      category: 'CAPITAL',
    });
    const { rerender } = render(<GamePage />);
    await waitFor(() => expect(screen.getByTestId('question-heading')).toHaveFocus());

    mocks.gameState.currentIndex = 1;
    rerender(<GamePage />);

    await waitFor(() => expect(screen.getByTestId('question-heading')).toHaveFocus());
  });

  it('plays a five-question trial using the real start flow without saving a ranked result', async () => {
    mockedSearchParams = 'category=MAP&gameType=practice&difficulty=HARD';
    render(<GamePage isTrial />);
    await waitFor(() => expect(mocks.startGameMock).toHaveBeenCalledWith('FLAG', 5, 'single', { difficulty: 'EASY' }));
    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'game.seeResults' }));
    await waitFor(() => expect(mocks.navigateMock).toHaveBeenCalledWith('/play/results'));
    expect(mocks.finishGameMock).not.toHaveBeenCalled();
  });

  it('permite reintentar el inicio sin salir al menú y conserva la configuración', async () => {
    mocks.startGameMock.mockRejectedValueOnce(new Error('offline'));
    mockedSearchParams = 'category=CAPITAL&difficulty=HARD';

    render(<GamePage />);

    await screen.findByText('offline');
    fireEvent.click(screen.getByRole('button', { name: 'error.retry' }));

    await waitFor(() => expect(mocks.startGameMock).toHaveBeenCalledTimes(2));
    expect(mocks.startGameMock.mock.calls[1]).toEqual(mocks.startGameMock.mock.calls[0]);
    expect(mocks.navigateMock).not.toHaveBeenCalled();
    await screen.findByRole('button', { name: 'Santiago' });
  });

  it('does not downgrade a trial when fewer than five questions are available', async () => {
    const isAxiosErrorSpy = vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    mocks.startGameMock.mockRejectedValueOnce({
      response: { data: { available: 3, requested: 5, canStartShortGame: true } },
    });
    mockedSearchParams = 'category=FLAG';

    render(<GamePage isTrial />);

    await waitFor(() => expect(screen.getByText('game.startError')).toBeInTheDocument());
    expect(confirmDialogStable.confirm).not.toHaveBeenCalled();
    expect(mocks.startGameMock.mock.calls.some((call) => call[1] === 3 || call[4] === true)).toBe(false);
    isAxiosErrorSpy.mockRestore();
  });

  it('carries category and every active filter into results', async () => {
    mockedSearchParams = 'category=CAPITAL&continent=Europe&difficulty=HARD&isInsular=true';
    render(<GamePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'game.seeResults' }));
    await waitFor(() => expect(mocks.navigateMock).toHaveBeenCalledWith('/results?category=CAPITAL&gameType=single&continent=Europe&isInsular=true&difficulty=HARD'));
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
    expect(mocks.navigateMock).not.toHaveBeenCalledWith('/results?category=CAPITAL&gameType=streak');
  });

  it('en modo streak con fallo termina la partida y navega a resultados', async () => {
    mockedSearchParams = 'category=CAPITAL&mode=streak';
    mocks.submitAnswerMock.mockResolvedValue({ isCorrect: false });

    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    await waitFor(() => {
      expect(mocks.finishGameMock).toHaveBeenCalledTimes(1);
      expect(mocks.navigateMock).toHaveBeenCalledWith('/results?category=CAPITAL&gameType=streak');
    });
    expect(mocks.nextQuestionMock).not.toHaveBeenCalled();
  });

  it('envía una sola respuesta aunque el envío se dispare dos veces seguidas', async () => {
    let resolveSubmit!: (value: { isCorrect: boolean; points: number }) => void;
    mocks.submitAnswerMock.mockReturnValue(new Promise((resolve) => {
      resolveSubmit = resolve;
    }));

    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    const submitButton = screen.getByRole('button', { name: 'game.submit' });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    expect(mocks.submitAnswerMock).toHaveBeenCalledTimes(1);
    expect(mocks.submitAnswerMock.mock.calls[0][3]).toBeGreaterThanOrEqual(0);
    expect(mocks.submitAnswerMock.mock.calls[0][3]).toBeLessThanOrEqual(10);

    resolveSubmit({ isCorrect: true, points: 100 });
    await screen.findByText('game.correct');
  });

  it('muestra el desglose real de puntos tras acertar', async () => {
    mocks.submitAnswerMock.mockResolvedValueOnce({
      isCorrect: true,
      points: 135,
      basePoints: 100,
      timeBonus: 35,
    });
    mocks.gameState.results = [Object.assign({ isCorrect: true }, {
      questionId: 'q1',
      correctAnswer: 'Santiago',
      userAnswer: 'Santiago',
      points: 135,
      basePoints: 100,
      timeBonus: 35,
    })];

    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    expect(await screen.findByText('game.scoreBreakdownDetail')).toBeInTheDocument();
  });

  it('mantiene la ronda y ofrece reintentar cuando falla el envío', async () => {
    mocks.submitAnswerMock.mockRejectedValueOnce(new Error('offline'));

    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('game.submitError');
    expect(screen.getByRole('button', { name: 'Santiago' })).toBeInTheDocument();
    expect(screen.queryByText('game.error')).not.toBeInTheDocument();

    mocks.submitAnswerMock.mockResolvedValueOnce({ isCorrect: true, points: 100 });
    fireEvent.click(screen.getByRole('button', { name: 'game.submitRetry' }));

    await screen.findByText('game.correct');
    expect(mocks.submitAnswerMock).toHaveBeenCalledTimes(2);
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

describe('GamePage abandonment guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    blockerMock.state = 'unblocked';
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
    mocks.gameState.results = [{ isCorrect: true }];
    mocks.gameState.status = 'playing';
    mocks.submitAnswerMock.mockResolvedValue({ isCorrect: true });
    confirmDialogStable.confirm.mockResolvedValue(true);
  });

  function abandonCallCount() {
    return uxMocks.trackUxEvent.mock.calls.filter(
      (call: unknown[]) => call[0] === 'game_abandoned'
    ).length;
  }

  it('exit click + unmount: fires exactly 1 game_abandoned', async () => {
    const { unmount } = render(<GamePage />);

    await screen.findByRole('button', { name: 'game.exit' });

    fireEvent.click(screen.getByRole('button', { name: 'game.exit' }));

    await waitFor(() => {
      expect(mocks.navigateMock).toHaveBeenCalledWith('/menu');
    });

    unmount();

    expect(abandonCallCount()).toBe(1);
  });

  it('finish + unmount: fires 0 game_abandoned', async () => {
    const { unmount } = render(<GamePage />);

    await screen.findByRole('button', { name: 'game.exit' });

    fireEvent.click(screen.getByRole('button', { name: 'Santiago' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.submit' }));

    await screen.findByText('game.correct');

    const seeResultsButton = await screen.findByRole('button', { name: 'game.seeResults' });
    fireEvent.click(seeResultsButton);

    await waitFor(() => {
      expect(mocks.finishGameMock).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(abandonCallCount()).toBe(0);
  });

  it('unmount during game: fires exactly 1 game_abandoned', async () => {
    const { unmount } = render(<GamePage />);

    await screen.findByRole('button', { name: 'game.exit' });

    unmount();

    expect(abandonCallCount()).toBe(1);
  });
});
