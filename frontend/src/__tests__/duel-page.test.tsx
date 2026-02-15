import { act, render, screen, waitFor } from '@testing-library/react';
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
    t: (key: string) => key,
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', username: 'player1' },
  }),
}));

vi.mock('../components', () => ({
  Timer: () => <div>timer</div>,
  QuestionCard: () => <div>question</div>,
  OptionButton: ({ option }: { option: string }) => <button>{option}</button>,
  LoadingSpinner: ({ text }: { text?: string }) => <div>{text || 'loading'}</div>,
  AnswerStatusBadge: ({ label }: { label: string }) => <div>{label}</div>,
}));


vi.mock('../components/MapInteractive', () => ({
  MapInteractive: ({ questionId }: { questionId?: string }) => (
    <div data-testid="map-interactive" data-question-id={questionId}>map</div>
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
