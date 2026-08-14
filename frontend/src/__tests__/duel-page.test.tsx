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
    emit: vi.fn(),
  };

  return {
    handlers,
    socketMock,
    navigateMock: vi.fn(),
    readyMock: vi.fn(),
    connectMock: vi.fn(),
    joinDuelQueueMock: vi.fn(),
    cancelDuelQueueMock: vi.fn(),
    submitDuelAnswerMock: vi.fn(),
    getCompetitionOverviewMock: vi.fn(),
    onConnectionStateChangeMock: vi.fn(() => () => {}),
    isConnectedMock: vi.fn(() => true),
    searchParams: 'category=FLAG',
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigateMock,
  useSearchParams: () => [new URLSearchParams(mocks.searchParams)],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: 'es' },
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
  UniversalGameLayout: ({ header, progress, content, footer }: any) => (
    <div>{header}{progress}{content}{footer}</div>
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
    submitDuelAnswer: mocks.submitDuelAnswerMock,
    onConnectionStateChange: mocks.onConnectionStateChangeMock,
    isConnected: mocks.isConnectedMock,
  },
}));

vi.mock('../services/api', () => ({
  api: {
    getCompetitionOverview: mocks.getCompetitionOverviewMock,
  },
}));

describe('DuelPage socket flow', () => {
  beforeEach(() => {
    mocks.handlers.clear();
    vi.clearAllMocks();
    mocks.searchParams = 'category=FLAG';
    mocks.getCompetitionOverviewMock.mockResolvedValue({
      ladders: {
        CLASSIC: {
          rating: 1100,
          peakRating: 1100,
          gamesPlayed: 6,
          wins: 4,
          draws: 1,
          losses: 1,
          provisional: false,
          placementGamesRemaining: 0,
          rank: 3,
          tier: 'CARTOGRAPHER',
        },
        GEO_CHALLENGE: {
          rating: 1000,
          peakRating: 1000,
          gamesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          provisional: true,
          placementGamesRemaining: 5,
          rank: null,
          tier: 'CALIBRATING',
        },
      },
      recentMatches: [],
    });
    vi.useRealTimers();
  });

  it('registra listeners antes de entrar a la cola y avanza al recibir oponente', async () => {
    render(<DuelPage />);

    expect(mocks.connectMock).toHaveBeenCalledTimes(1);
    expect(mocks.socketMock.on).toHaveBeenCalled();

    const registerCallOrder = mocks.socketMock.on.mock.invocationCallOrder[0];
    const joinCallOrder = mocks.joinDuelQueueMock.mock.invocationCallOrder[0];

    expect(registerCallOrder).toBeLessThan(joinCallOrder);
    expect(mocks.joinDuelQueueMock).toHaveBeenCalledWith('FLAG', {}, 'classic', false);

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

  it('juega GeoRetos en duelo con 10 rondas y conserva el orden seleccionado', async () => {
    mocks.searchParams = 'mode=geo-challenge';
    render(<DuelPage />);

    expect(mocks.joinDuelQueueMock).toHaveBeenCalledWith('MIXED', {}, 'geo-challenge', false);

    act(() => {
      mocks.handlers.get('duel:question')?.forEach((cb) => cb({
        questionIndex: 0,
        totalQuestions: 10,
        timeLimit: 25,
        question: {
          id: 'geo-1',
          category: 'MIXED',
          questionText: 'Ordena los países',
          options: ['CA', 'US', 'MX', 'GT'],
          correctAnswer: '',
          geoChallenge: {
            id: 'geo-1',
            kind: 'NORTH_TO_SOUTH',
            region: 'AMERICAS',
            difficulty: 'MEDIUM',
            selectionMode: 'ordered',
            prompt: { es: 'Ordena los países', en: 'Order the countries' },
            instruction: { es: 'De norte a sur', en: 'North to south' },
            options: [
              { id: 'CA', label: { es: 'Canadá', en: 'Canada' } },
              { id: 'US', label: { es: 'Estados Unidos', en: 'United States' } },
              { id: 'MX', label: { es: 'México', en: 'Mexico' } },
              { id: 'GT', label: { es: 'Guatemala', en: 'Guatemala' } },
            ],
          },
        },
      }));
    });

    for (const country of ['Canadá', 'Estados Unidos', 'México', 'Guatemala']) {
      fireEvent.click(await screen.findByRole('button', { name: country }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'geoChallenges.confirm' }));

    expect(mocks.submitDuelAnswerMock).toHaveBeenCalledWith(
      'geo-1',
      'CA,US,MX,GT',
      25,
    );
  });

  it('envía rated=true para Ranked Classic y Ranked GeoRetos', () => {
    mocks.searchParams = 'rated=1&category=MIXED';
    render(<DuelPage />);
    expect(mocks.joinDuelQueueMock).toHaveBeenCalledWith('MIXED', {}, 'classic', true);

    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.searchParams = 'rated=1&mode=geo-challenge';
    render(<DuelPage />);
    expect(mocks.joinDuelQueueMock).toHaveBeenCalledWith('MIXED', {}, 'geo-challenge', true);
  });

  it('reconoce los 4 kinds nuevos en GeoRetos Duel: ORDER_BY_METRIC ordered', async () => {
    mocks.searchParams = 'mode=geo-challenge';
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('duel:question')?.forEach((cb) => cb({
        questionIndex: 0,
        totalQuestions: 10,
        timeLimit: 25,
        question: {
          id: 'geo-oby',
          category: 'MIXED',
          questionText: 'Ordena por población',
          options: ['BR', 'AR', 'CL', 'UY'],
          correctAnswer: '',
          geoChallenge: {
            id: 'geo-oby',
            kind: 'ORDER_BY_METRIC',
            region: 'AMERICAS',
            difficulty: 'MEDIUM',
            selectionMode: 'ordered',
            prompt: { es: 'Ordena de mayor a menor población', en: 'Order by population' },
            instruction: { es: 'De mayor a menor', en: 'Largest to smallest' },
            options: [
              { id: 'BR', label: { es: 'Brasil', en: 'Brazil' } },
              { id: 'AR', label: { es: 'Argentina', en: 'Argentina' } },
              { id: 'CL', label: { es: 'Chile', en: 'Chile' } },
              { id: 'UY', label: { es: 'Uruguay', en: 'Uruguay' } },
            ],
          },
        },
      }));
    });

    for (const country of ['Brasil', 'Argentina', 'Chile', 'Uruguay']) {
      fireEvent.click(await screen.findByRole('button', { name: country }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'geoChallenges.confirm' }));

    expect(mocks.submitDuelAnswerMock).toHaveBeenCalledWith(
      'geo-oby',
      'BR,AR,CL,UY',
      25,
    );
  });

  it('reconoce BORDER_CHAIN como ordered en GeoRetos Duel', async () => {
    mocks.searchParams = 'mode=geo-challenge';
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('duel:question')?.forEach((cb) => cb({
        questionIndex: 0,
        totalQuestions: 10,
        timeLimit: 25,
        question: {
          id: 'geo-bc',
          category: 'MIXED',
          questionText: 'Ruta terrestre',
          options: ['PT', 'ES', 'FR', 'BE'],
          correctAnswer: '',
          geoChallenge: {
            id: 'geo-bc',
            kind: 'BORDER_CHAIN',
            region: 'EUROPE',
            difficulty: 'HARD',
            selectionMode: 'ordered',
            prompt: { es: 'Construye una ruta terrestre', en: 'Build a land route' },
            instruction: { es: 'Cada país limita con el siguiente', en: 'Each borders the next' },
            options: [
              { id: 'PT', label: { es: 'Portugal', en: 'Portugal' } },
              { id: 'ES', label: { es: 'España', en: 'Spain' } },
              { id: 'FR', label: { es: 'Francia', en: 'France' } },
              { id: 'BE', label: { es: 'Bélgica', en: 'Belgium' } },
            ],
          },
        },
      }));
    });

    for (const country of ['Portugal', 'España', 'Francia', 'Bélgica']) {
      fireEvent.click(await screen.findByRole('button', { name: country }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'geoChallenges.confirm' }));

    expect(mocks.submitDuelAnswerMock).toHaveBeenCalledWith(
      'geo-bc',
      'PT,ES,FR,BE',
      25,
    );
  });

  it('muestra contexto empático durante la búsqueda del duelo', async () => {
    render(<DuelPage />);

    expect(await screen.findByText(/duel\.queueCategory/)).toBeInTheDocument();
    expect(screen.getByText('duel.averageWaitHint')).toBeInTheDocument();
    expect(screen.getByText('duel.cancelHint')).toBeInTheDocument();
  });

  it('renderiza alternativas en lista vertical durante el duelo', async () => {
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

    expect(optionsGrid).toHaveClass('game-options-grid');
    expect(optionsGrid).not.toHaveClass('grid-cols-2');
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

    const tray = await screen.findByTestId('mobile-action-tray');
    expect(tray).toHaveClass('fixed');
    expect(tray).toHaveClass('bottom-0');
  });

  it('auto-confirma la respuesta al seleccionar una opción y muestra espera', async () => {
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

    // La respuesta se envía automáticamente al seleccionar
    expect(mocks.submitDuelAnswerMock).toHaveBeenCalledWith('dq1', 'Santiago', expect.any(Number), undefined, undefined);
    // El tray muestra "esperando oponente" en lugar del botón de confirmar
    expect(screen.getByText('duel.waitingForOpponent')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'game.submit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'game.clearSelection' })).not.toBeInTheDocument();
  });

  it('prioriza una interfaz limpia sin mensajes de bajo tiempo en el cuerpo', async () => {
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

    expect(screen.queryByText(/game\.lowTimeHint/)).not.toBeInTheDocument();
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

    expect(mocks.socketMock.on).toHaveBeenCalledTimes(10);

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

    expect(mocks.socketMock.on).toHaveBeenCalledTimes(10);
  });

  it('casual finish no muestra rating', async () => {
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('duel:finished')?.forEach((cb) =>
        cb({
          reason: 'completed',
          rated: false,
          winnerId: 'u1',
          results: [
            { userId: 'u1', username: 'player1', score: 200 },
            { userId: 'u2', username: 'rival', score: 100 },
          ],
        })
      );
    });

    expect(await screen.findByText('duel.youWin')).toBeInTheDocument();
    expect(screen.queryByText('duel.ratingUpdating')).not.toBeInTheDocument();
  });

  it('ranked finish espera duel:rating y muestra before/delta/after con calibración', async () => {
    mocks.searchParams = 'rated=1&category=MIXED';
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('duel:finished')?.forEach((cb) =>
        cb({
          reason: 'completed',
          rated: true,
          ladder: 'CLASSIC',
          winnerId: 'u1',
          results: [
            { userId: 'u1', username: 'player1', score: 200 },
            { userId: 'u2', username: 'rival', score: 100 },
          ],
        })
      );
    });

    expect(await screen.findByText('duel.ratingUpdating')).toBeInTheDocument();

    act(() => {
      mocks.handlers.get('duel:rating')?.forEach((cb) =>
        cb({
          status: 'updated',
          ladder: 'CLASSIC',
          ratingBefore: 1084,
          ratingDelta: 16,
          ratingAfter: 1100,
          peakRating: 1100,
          gamesPlayed: 3,
          provisional: true,
          placementGamesRemaining: 2,
          tier: 'CALIBRATING',
        })
      );
    });

    expect(await screen.findByText('1084 → 1100')).toBeInTheDocument();
    expect(screen.getByText('+16')).toBeInTheDocument();
    expect(screen.getByText(/duel\.placementRemaining/)).toBeInTheDocument();
  });

  it('fallback de rating consulta overview tras 4s y no inventa delta', async () => {
    vi.useFakeTimers();
    mocks.searchParams = 'rated=1&category=MIXED';
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('duel:finished')?.forEach((cb) =>
        cb({
          reason: 'completed',
          rated: true,
          ladder: 'CLASSIC',
          winnerId: 'u1',
          results: [
            { userId: 'u1', username: 'player1', score: 200 },
            { userId: 'u2', username: 'rival', score: 100 },
          ],
        })
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(mocks.getCompetitionOverviewMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('duel.ratingUpdated')).toBeInTheDocument();
    expect(screen.queryByText('+16')).not.toBeInTheDocument();
  });

  it('fallback de rating muestra estado graceful si overview falla', async () => {
    vi.useFakeTimers();
    mocks.getCompetitionOverviewMock.mockRejectedValue(new Error('network'));
    mocks.searchParams = 'rated=1&category=MIXED';
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('duel:finished')?.forEach((cb) =>
        cb({
          reason: 'completed',
          rated: true,
          ladder: 'CLASSIC',
          winnerId: 'u1',
          results: [
            { userId: 'u1', username: 'player1', score: 200 },
            { userId: 'u2', username: 'rival', score: 100 },
          ],
        })
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(screen.getByText('duel.ratingUpdateError')).toBeInTheDocument();
  });

  it('muestra banner no bloqueante cuando llega duel:error y permite reintentar', async () => {
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('duel:error')?.forEach((cb) =>
        cb({ message: 'Server duel error' })
      );
    });

    expect(await screen.findByText('Server duel error')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'duel.retry' }));
    expect(mocks.joinDuelQueueMock).toHaveBeenCalledTimes(2);
  });

  it('reingresa automáticamente a matchmaking al reconectar en searching', async () => {
    render(<DuelPage />);

    act(() => {
      mocks.handlers.get('connect')?.forEach((cb) => cb());
    });

    expect(mocks.joinDuelQueueMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('duel.reconnectedSearching')).toBeInTheDocument();
  });

  it('al reconectar en ronda muestra sincronización y bloquea selección de opciones', async () => {
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

    // Click Santiago → auto-submit ocurre
    fireEvent.click(await screen.findByRole('button', { name: 'Santiago' }));
    expect(mocks.submitDuelAnswerMock).toHaveBeenCalledTimes(1);

    act(() => {
      mocks.handlers.get('connect')?.forEach((cb) => cb());
    });

    expect(await screen.findByText('duel.reconnectedSyncing')).toBeInTheDocument();

    // Las opciones están deshabilitadas por isSyncingRound — no se puede enviar otra respuesta
    const limaButton = screen.getByRole('button', { name: 'Lima' });
    expect(limaButton).toBeDisabled();
    fireEvent.click(limaButton);
    expect(mocks.submitDuelAnswerMock).toHaveBeenCalledTimes(1); // sigue siendo 1
  });
});
