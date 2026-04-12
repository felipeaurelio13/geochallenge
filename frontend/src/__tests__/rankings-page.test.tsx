import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLeaderboardMock: vi.fn(),
  getMyRankMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'common.back': 'Volver',
        'common.search': 'Buscar',
        'common.retry': 'Reintentar',
        'rankings.title': 'Rankings',
        'rankings.loading': 'Cargando ranking...',
        'rankings.empty': 'Aún no hay jugadores en el ranking',
        'rankings.noSearchResults': 'No hay resultados para esta búsqueda',
        'rankings.searchPlaceholder': options?.defaultValue ?? 'Buscar jugador...',
        'rankings.you': 'Tú',
        'rankings.stats': 'Estadísticas',
        'rankings.totalPlayers': 'Jugadores',
        'rankings.topScore': 'Mejor puntuación',
        'rankings.avgScore': 'Promedio',
      };

      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'neo' },
  }),
}));

vi.mock('../services/api', () => ({
  api: {
    getLeaderboard: () => mocks.getLeaderboardMock(),
    getMyRank: () => mocks.getMyRankMock(),
  },
}));

describe('RankingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLeaderboardMock.mockReset();
    mocks.getMyRankMock.mockReset();
    vi.stubEnv('VITE_RANKING_USE_BACKEND_RANK', 'true');
    vi.stubEnv('VITE_RANKING_NEIGHBORS_ENABLED', 'false');
    mocks.getMyRankMock.mockResolvedValue({ userRank: null, neighbors: [] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('../hooks');
  });

  it('renderiza top con datos, estructura visual mobile/dark y resalta usuario actual', async () => {
    vi.resetModules();
    const { RankingsPage } = await import('../pages/RankingsPage');

    mocks.getLeaderboardMock.mockResolvedValue({
      leaderboard: [
        { rank: 1, userId: 'u-1', username: 'neo', score: 1200 },
        { rank: 2, userId: 'u-2', username: 'trinity', score: 1100 },
      ],
      totalPlayers: 99,
      topScore: 1200,
      avgScore: 950,
      userRank: { rank: 1, score: 1200 },
    });

    const { container } = render(<RankingsPage />);

    expect(await screen.findByText('🥇')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.getLeaderboardMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('(Tú)')).toBeInTheDocument();

    expect(container.firstChild).toHaveClass('h-full', 'min-h-0', 'bg-gray-900');
    expect(container.querySelector('header')).toHaveClass('bg-gray-800', 'border-b', 'border-gray-700');

    const search = screen.getByLabelText('Buscar');
    expect(search).toHaveClass('bg-gray-800', 'text-white', 'placeholder-gray-500');

    const currentUserCard = screen.getByText('neo').closest('div.p-4.rounded-xl.border-2');
    expect(currentUserCard).toHaveClass('bg-primary/20', 'border-primary');
  });

  it('usa rank provisto por backend y no index + 1', async () => {
    vi.resetModules();
    const { RankingsPage } = await import('../pages/RankingsPage');

    mocks.getLeaderboardMock.mockResolvedValue({
      leaderboard: [
        { rank: 11, userId: 'u-1', username: 'neo', score: 1200 },
        { rank: 15, userId: 'u-2', username: 'trinity', score: 1100 },
      ],
      totalPlayers: 2,
      topScore: 1200,
      avgScore: 1150,
      userRank: { rank: 11, score: 1200 },
    });

    render(<RankingsPage />);

    expect(await screen.findByText('#11')).toBeInTheDocument();
    expect(screen.getByText('#15')).toBeInTheDocument();
    expect(screen.queryByText('🥇')).not.toBeInTheDocument();
  });

  it('permite búsqueda con resultado y sin resultado sin romper métricas globales', async () => {
    vi.resetModules();
    const { RankingsPage } = await import('../pages/RankingsPage');

    mocks.getLeaderboardMock.mockResolvedValue({
      leaderboard: [
        { rank: 4, userId: 'u-1', username: 'neo', score: 1200 },
        { rank: 5, userId: 'u-2', username: 'trinity', score: 1100 },
      ],
      totalPlayers: 999,
      topScore: 7777,
      avgScore: 1234,
      userRank: { rank: 4, score: 1200 },
    });

    render(<RankingsPage />);

    expect(await screen.findByText('#4')).toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();
    expect(screen.getByText('7,777')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'neo' } });
    expect(await screen.findByText(/Resultados filtrados:/i)).toBeInTheDocument();
    expect(screen.getByText('neo')).toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();
    expect(screen.getByText('7,777')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'smith' } });
    expect(await screen.findByText('No hay resultados para esta búsqueda')).toBeInTheDocument();
    expect(screen.queryByText('Aún no hay jugadores en el ranking')).not.toBeInTheDocument();
  });

  it('muestra error y permite reintentar', async () => {
    vi.resetModules();

    mocks.getLeaderboardMock.mockResolvedValue({
      leaderboard: [{ rank: 1, userId: 'u-1', username: 'neo', score: 1200 }],
      totalPlayers: 1,
      topScore: 1200,
      avgScore: 1200,
      userRank: { rank: 1, score: 1200 },
    });

    vi.doMock('../hooks', async () => {
      const React = await import('react');

      return {
        useDebounce: (value: string) => value,
        useApi: () => {
          const [data, setData] = React.useState<any>(null);
          const [error, setError] = React.useState<string | null>('network down');
          const [isLoading, setIsLoading] = React.useState(false);
          const allowSuccessRef = React.useRef(false);

          const run = React.useCallback(async () => {
            if (!allowSuccessRef.current) {
              return null;
            }

            setIsLoading(true);
            const response = await mocks.getLeaderboardMock();
            setData({
              leaderboard: response.leaderboard.map((entry: any) => ({
                ...entry,
                isCurrentUser: entry.username === 'neo',
              })),
              totalPlayers: response.totalPlayers,
              topScore: response.topScore,
              avgScore: response.avgScore,
              userRank: response.userRank?.rank ?? null,
              userScore: response.userRank?.score ?? null,
            });
            setError(null);
            setIsLoading(false);
            return response;
          }, []);

          const invalidate = React.useCallback(() => {
            allowSuccessRef.current = true;
          }, []);

          return {
            data,
            error,
            isLoading,
            run,
            invalidate,
          };
        },
      };
    });

    const { RankingsPage } = await import('../pages/RankingsPage');
    render(<RankingsPage />);

    expect(screen.getByText('network down')).toBeInTheDocument();

    const callsBeforeRetry = mocks.getLeaderboardMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(mocks.getLeaderboardMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
    expect(await screen.findByText('🥇')).toBeInTheDocument();
  });

});
