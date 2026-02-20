import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DuelPage } from '../pages/DuelPage';

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, Array<(data?: any) => void>>();

  const socketMock = {
    on: vi.fn((event: string, cb: (data?: any) => void) => {
      const current = handlers.get(event) || [];
      handlers.set(event, [...current, cb]);
    }),
    off: vi.fn((event: string, cb: (data?: any) => void) => {
      const current = handlers.get(event) || [];
      handlers.set(
        event,
        current.filter((handler) => handler !== cb)
      );
    }),
  };

  return {
    handlers,
    socketMock,
    navigateMock: vi.fn(),
    readyMock: vi.fn(),
    connectMock: vi.fn(),
    joinDuelQueueMock: vi.fn(),
    cancelDuelQueueMock: vi.fn(),
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigateMock,
  useSearchParams: () => [new URLSearchParams('category=FLAG')],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', username: 'player1' },
  }),
}));

vi.mock('../components', () => ({
  Timer: ({ onTick }: { onTick?: (value: number) => void }) => (
    <button type="button" onClick={() => onTick?.(4)}>
      timer
    </button>
  ),
  QuestionCard: () => <div>question</div>,
  OptionButton: ({ option, onClick }: { option: string; onClick: () => void }) => (
    <button onClick={onClick}>{option}</button>
  ),
  LoadingSpinner: ({ text }: { text?: string }) => <div>{text || 'loading'}</div>,
  AnswerStatusBadge: ({ label }: { label: string }) => <div>{label}</div>,

  RoundActionTray: ({ showResult, canSubmit, isWaiting, submitLabel, clearLabel, nextLabel, waitingLabel, onSubmit, onNext, onClear, showClearButton, resultLabel }: any) => (
    <div data-testid="mobile-action-tray" className='fixed bottom-0'>
      {!showResult && !isWaiting && (
        <>
          {showClearButton && <button onClick={onClear}>{clearLabel}</button>}
          <button onClick={onSubmit} disabled={!canSubmit}>{submitLabel}</button>
        </>
      )}
      {isWaiting && <p>{waitingLabel}</p>}
      {showResult && nextLabel && <button onClick={onNext}>{nextLabel}</button>}
      {showResult && resultLabel && <p>{resultLabel}</p>}
    </div>
  ),
  GameRoundScaffold: ({ header, progress, actionTray, mapContent, isMapQuestion, question, onOptionSelect, showResult, disableOptions, contextHint, isLowTime, lowTimeHint, optionsGridClassName, rootClassName, mainClassName }: any) => (
    <div className={rootClassName}>
      {header}
      {progress}
      <main role="main" className={mainClassName}>
        <div data-testid="question-card" data-compact="true">question-card</div>
        {isMapQuestion ? (mapContent) : (
          <div className={optionsGridClassName}>
            {question.options.map((option: string) => (
              <button key={option} onClick={() => onOptionSelect(option)} disabled={showResult || disableOptions}>{option}</button>
            ))}
          </div>
        )}
        {contextHint && !showResult && <p>{isLowTime && lowTimeHint ? lowTimeHint : contextHint}</p>}
        {actionTray}
      </main>
    </div>
  ),
}));

vi.mock('../components/MapInteractive', () => ({
  MapInteractive: ({ questionId }: { questionId?: string }) => (
    <div data-testid="map-interactive" data-question-id={questionId}>
      map
    </div>
  ),
}));

vi.mock('../services/socket', () => ({
  socketService: {
    socket: mocks.socketMock,
    connect: mocks.connectMock,
    joinDuelQueue: mocks.joinDuelQueueMock,
    cancelDuelQueue: mocks.cancelDuelQueueMock,
    ready: mocks.readyMock,
    submitDuelAnswer: vi.fn(),
  },
}));

describe('DuelPage socket flow', () => {
  beforeEach(() => {
    mocks.handlers.clear();
    vi.clearAllMocks();
  });

  it('registra listeners antes de entrar a la cola y avanza al recibir oponente', async () => {
    render(<DuelPage />);

    expect(mocks.connectMock).toHaveBeenCalledTimes(1);
    expect(mocks.socketMock.on).toHaveBeenCalled();

    const registerCallOrder = mocks.socketMock.on.mock.invocationCallOrder[0];
    const joinCallOrder = mocks.joinDuelQueueMock.mock.invocationCallOrder[0];

    expect(registerCallOrder).toBeLessThan(joinCallOrder);
    expect(mocks.joinDuelQueueMock).toHaveBeenCalledWith('FLAG');

    act(() => {
      mocks.handlers.get('duel:matched')?.forEach((cb) => cb({ duelId: 'd1' }));
    });

    await waitFor(() => {
      expect(mocks.readyMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      mocks.handlers.get('duel:opponent')?.forEach((cb) =>
        cb({ userId: 'u2', username: 'rival' })
      );
    });

    expect(await screen.findByText('rival')).toBeInTheDocument();
  });

  it('muestra contexto empático durante la búsqueda del duelo', async () => {
    render(<DuelPage />);

    expect(await screen.findByText(/duel\.queueCategory/)).toBeInTheDocument();
    expect(screen.getByText('duel.averageWaitHint')).toBeInTheDocument();
    expect(screen.getByText('duel.cancelHint')).toBeInTheDocument();
  });

  it('renderiza alternativas en grilla de dos columnas en mobile durante el duelo', async () => {
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('duel:question')?.forEach((cb) =>
        cb({
          questionIndex: 0,
          totalQuestions: 10,
          question: {
            id: 'dq1',
            questionText: 'Capital de Chile',
            options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
            correctAnswer: 'Santiago',
            category: 'CAPITAL',
          },
        })
      );
    });

    const firstOption = await screen.findByRole('button', { name: 'Santiago' });
    const optionsGrid = firstOption.parentElement;

    expect(optionsGrid).toHaveClass('grid');
    expect(optionsGrid).toHaveClass('grid-cols-2');
  });


  it('ancla la bandeja de acciones en mobile para CTA siempre visible', async () => {
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('duel:question')?.forEach((cb) =>
        cb({
          questionIndex: 0,
          totalQuestions: 10,
          question: {
            id: 'dq1',
            questionText: 'Capital de Chile',
            options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
            correctAnswer: 'Santiago',
            category: 'CAPITAL',
          },
        })
      );
    });

    const main = screen.getByRole('main');
    expect(main.className).toContain('pb-[6.35rem]');

    const tray = await screen.findByTestId('mobile-action-tray');
    expect(tray).toHaveClass('fixed');
    expect(tray).toHaveClass('bottom-0');
  });

  it('prioriza confirmar sin mostrar CTA secundario al elegir respuesta', async () => {
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('duel:question')?.forEach((cb) =>
        cb({
          questionIndex: 0,
          totalQuestions: 10,
          question: {
            id: 'dq1',
            questionText: 'Capital de Chile',
            options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
            correctAnswer: 'Santiago',
            category: 'CAPITAL',
          },
        })
      );
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Santiago' }));

    expect(screen.getByRole('button', { name: 'game.submit' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'game.clearSelection' })).not.toBeInTheDocument();
  });

  it('muestra mensaje de bajo tiempo al entrar a los últimos segundos', async () => {
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('duel:question')?.forEach((cb) =>
        cb({
          questionIndex: 0,
          totalQuestions: 10,
          question: {
            id: 'dq1',
            questionText: 'Capital de Chile',
            options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
            correctAnswer: 'Santiago',
            category: 'CAPITAL',
          },
        })
      );
    });

    fireEvent.click(await screen.findByRole('button', { name: 'timer' }));

    expect(await screen.findByText(/game\.lowTimeHint/)).toBeInTheDocument();
  });

  it('envía el questionId al mapa para resetear viewport entre preguntas de mapa consecutivas', async () => {
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('duel:question')?.forEach((cb) =>
        cb({
          questionIndex: 0,
          totalQuestions: 10,
          question: {
            id: 'map-1',
            questionText: 'Ubica París',
            options: [],
            correctAnswer: '',
            category: 'MAP',
          },
        })
      );
    });

    const map = await screen.findByTestId('map-interactive');
    expect(map).toHaveAttribute('data-question-id', 'map-1');
  });

  it('mantiene una sola suscripción de sockets aunque cambie el score', async () => {
    render(<DuelPage />);

    expect(mocks.socketMock.on).toHaveBeenCalledTimes(6);

    act(() => {
      mocks.handlers.get('duel:questionResult')?.forEach((cb) =>
        cb({
          results: [
            {
              userId: 'u1',
              username: 'player1',
              totalScore: 300,
              answer: { isCorrect: true },
            },
            {
              userId: 'u2',
              username: 'rival',
              totalScore: 100,
              answer: { isCorrect: false },
            },
          ],
        })
      );
    });

    expect(mocks.socketMock.on).toHaveBeenCalledTimes(6);
  });
});
