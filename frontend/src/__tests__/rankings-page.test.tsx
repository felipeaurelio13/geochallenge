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
        'common.clear': 'Limpiar búsqueda',
        'rankings.title': 'Rankings',
        'rankings.loading': 'Cargando ranking...',
        'rankings.empty': 'Aún no hay jugadores en el ranking',
        'rankings.noSearchResults': 'No hay resultados para esta búsqueda',
        'rankings.searchPlaceholder': options?.defaultValue ?? 'Buscar jugador...',
        'rankings.scopeAriaLabel': 'Cambiar tipo de ranking',
        'rankings.you': 'Tú',
        'rankings.global': 'Global',
        'rankings.season': 'Mes',
        'rankings.stats': 'Estadísticas',
        'rankings.totalPlayers': 'Jugadores',
        'rankings.topScore': 'Mejor puntuación',
        'rankings.avgScore': 'Promedio',
        'rankings.filteredResults': 'Resultados filtrados',
        'rankings.otherPlayers': 'Otros jugadores',
        'rankings.globalStats': 'Estadísticas globales',
        'rankings.seasonStats': 'Estadísticas del mes',
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
    getLeaderboard: (limit?: number, scope?: 'global' | 'season') => mocks.getLeaderboardMock(limit, scope),
    getMyRank: (scope?: 'global' | 'season') => mocks.getMyRankMock(scope),
  },
}));

describe('RankingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLeaderboardMock.mockReset();
    mocks.getMyRankMock.mockReset();
    vi.stubEnv('VITE_RANKING_NEIGHBORS_ENABLED', 'false');
    mocks.getMyRankMock.mockResolvedValue({ userRank: null, neighbors: [], scope: 'global' });
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
      scope: 'global',
    });

    const { container } = render(<RankingsPage />);

    expect(await screen.findByText('🥇')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.getLeaderboardMock).toHaveBeenCalledTimes(1);
    });
    expect(mocks.getLeaderboardMock).toHaveBeenCalledWith(50, 'global');
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('(Tú)')).toBeInTheDocument();

    expect(container.firstChild).toHaveClass('h-full', 'min-h-0', 'bg-[var(--color-bg-app)]');
    expect(container.querySelector('header')).toHaveClass('bg-[var(--color-surface-muted)]', 'border-b', 'border-[var(--color-border)]');

    const search = screen.getByLabelText('Buscar');
    expect(search).toHaveClass('bg-[var(--color-surface-muted)]', 'text-[var(--color-text-primary)]', 'placeholder-[var(--color-text-muted)]');

    expect(screen.getByText('(Tú)')).toHaveClass('text-primary');
  });

  it('siempre usa el rank provisto por el backend (no recalcula con index)', async () => {
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
      scope: 'global',
    });

    render(<RankingsPage />);

    expect(await screen.findByText('#11')).toBeInTheDocument();
    expect(screen.getByText('#15')).toBeInTheDocument();
    expect(screen.queryByText('🥇')).not.toBeInTheDocument();
  });

  it('cambia a scope season cuando el usuario clickea el tab Mes', async () => {
    vi.resetModules();
    const { RankingsPage } = await import('../pages/RankingsPage');

    mocks.getLeaderboardMock
      .mockResolvedValueOnce({
        leaderboard: [{ rank: 1, userId: 'u-1', username: 'neo', score: 1000 }],
        totalPlayers: 1,
        topScore: 1000,
        avgScore: 1000,
        userRank: { rank: 1, score: 1000 },
        scope: 'global',
      })
      .mockResolvedValueOnce({
        leaderboard: [{ rank: 1, userId: 'u-1', username: 'neo', score: 500 }],
        totalPlayers: 1,
        topScore: 500,
        avgScore: 500,
        userRank: { rank: 1, score: 500 },
        scope: 'season',
        season: '2026-05',
      });

    render(<RankingsPage />);

    expect(await screen.findByText('🥇')).toBeInTheDocument();
    expect(mocks.getLeaderboardMock).toHaveBeenCalledWith(50, 'global');

    const seasonTab = screen.getByRole('tab', { name: /Mes/ });
    fireEvent.click(seasonTab);

    await waitFor(() => {
      expect(mocks.getLeaderboardMock).toHaveBeenCalledWith(50, 'season');
    });
    expect(await screen.findByText('Estadísticas del mes')).toBeInTheDocument();
    expect(screen.getByText('2026-05')).toBeInTheDocument();
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
      scope: 'global',
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
      scope: 'global',
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
              scope: response.scope,
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
