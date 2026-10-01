import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SurvivalPage } from '../pages/SurvivalPage';

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, Array<(...args: any[]) => void>>();
  const socketMock = {
    on: vi.fn((event: string, cb: (...args: any[]) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), cb]);
    }),
    off: vi.fn(),
    emit: vi.fn(),
  };
  return {
    handlers,
    socketMock,
    navigateMock: vi.fn(),
    confirmMock: vi.fn(),
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigateMock,
  useSearchParams: () => [new URLSearchParams('category=FLAG')],
}));

const i18nMock = vi.hoisted(() => {
  const t = (key: string) => key;
  return { t, i18n: { language: 'es' } };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => i18nMock,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', username: 'player1' } }),
}));

vi.mock('../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: mocks.confirmMock, confirmDialog: null, isOpen: false }),
}));

vi.mock('../services/api', () => ({ api: {} }));

vi.mock('../services/socket', () => ({
  socketService: {
    socket: mocks.socketMock,
    connect: vi.fn(),
    isConnected: () => true,
    onConnectionStateChange: () => () => {},
  },
}));

vi.mock('../components', () => ({
  LoadingSpinner: () => <div>loading</div>,
  Button: ({ onClick, children }: any) => <button onClick={onClick}>{children}</button>,
  Timer: () => <div>timer</div>,
  RoundActionTray: () => <div>tray</div>,
  GameRoundScaffold: ({ header, question, onOptionSelect, disableOptions, showResult }: any) => (
    <div>
      {header}
      {question.options.map((option: string) => (
        <button key={option} onClick={() => onOptionSelect(option)} disabled={showResult || disableOptions}>
          {option}
        </button>
      ))}
    </div>
  ),
}));

function emit(event: string, payload: unknown) {
  act(() => {
    mocks.handlers.get(event)?.forEach((cb) => cb(payload));
  });
}

function startRound() {
  emit('survival:matched', {
    matchId: 'm1',
    category: 'FLAG',
    fillTimeRemaining: 15,
    maxPlayers: 2,
    players: [{ userId: 'u1', username: 'player1', lives: 4, score: 0, eliminated: false }],
  });
  emit('survival:question', {
    round: 1,
    difficulty: 'EASY',
    timeLimit: 15,
    players: [{ userId: 'u1', username: 'player1', lives: 4, score: 0, eliminated: false }],
    question: {
      id: 'sq1',
      category: 'CAPITAL',
      questionText: 'Capital de Chile',
      options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
      correctAnswer: '',
    },
  });
}

describe('SurvivalPage guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.confirmMock.mockResolvedValue(true);
  });

  it('emite una sola respuesta aunque el jugador toque otra opción tras el envío', async () => {
    render(<SurvivalPage />);
    startRound();

    fireEvent.click(await screen.findByRole('button', { name: 'Santiago' }));
    await waitFor(() => {
      expect(mocks.socketMock.emit).toHaveBeenCalledWith(
        'survival:answer',
        expect.objectContaining({ questionId: 'sq1', answer: 'Santiago' }),
      );
    });

    const lima = screen.getByRole('button', { name: 'Lima' });
    expect(lima).toBeDisabled();
    fireEvent.click(lima);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const answers = mocks.socketMock.emit.mock.calls.filter(([event]) => event === 'survival:answer');
    expect(answers).toHaveLength(1);
  });

  it('pide confirmación antes de abandonar una partida en curso', async () => {
    mocks.confirmMock.mockResolvedValueOnce(false);
    render(<SurvivalPage />);
    startRound();

    const back = await screen.findByRole('button', { name: /survival\.backToMenu/ });
    fireEvent.click(back);
    await waitFor(() => expect(mocks.confirmMock).toHaveBeenCalledWith('game.confirmExit'));
    expect(mocks.navigateMock).not.toHaveBeenCalled();

    fireEvent.click(back);
    await waitFor(() => expect(mocks.navigateMock).toHaveBeenCalled());
  });

  it('activa beforeunload solo mientras se juega', async () => {
    render(<SurvivalPage />);

    const idle = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);

    startRound();
    await screen.findByRole('button', { name: 'Santiago' });
    const playing = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(playing);
    expect(playing.defaultPrevented).toBe(true);
  });
});
