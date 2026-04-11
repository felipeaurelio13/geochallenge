import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLeaderboard: vi.fn(),
  getMyRank: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'neo' } }),
}));

vi.mock('../services/api', () => ({
  api: {
    getLeaderboard: mocks.getLeaderboard,
    getMyRank: mocks.getMyRank,
  },
}));

describe('RankingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMyRank.mockResolvedValue({ userRank: null, neighbors: [] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('usa rank del backend cuando VITE_RANKING_USE_BACKEND_RANK=true', async () => {
    vi.stubEnv('VITE_RANKING_USE_BACKEND_RANK', 'true');
    vi.resetModules();
    const { RankingsPage } = await import('../pages/RankingsPage');

    mocks.getLeaderboard.mockResolvedValue({
      leaderboard: [
        { rank: 11, userId: 'u-1', username: 'neo', score: 1200 },
        { rank: 15, userId: 'u-2', username: 'trinity', score: 1100 },
      ],
      totalPlayers: 2,
      topScore: 1200,
      userRank: { rank: 11, score: 1200 },
    });

    render(<RankingsPage />);

    expect(await screen.findByText('#11')).toBeInTheDocument();
    expect(screen.getByText('#15')).toBeInTheDocument();
    expect(mocks.getMyRank).not.toHaveBeenCalled();
  });

  it('cae a index + 1 cuando falta entry.rank aunque el flag esté activo', async () => {
    vi.stubEnv('VITE_RANKING_USE_BACKEND_RANK', 'true');
    vi.resetModules();
    const { RankingsPage } = await import('../pages/RankingsPage');

    mocks.getLeaderboard.mockResolvedValue({
      leaderboard: [
        { rank: undefined, userId: 'u-3', username: 'morpheus', score: 900 },
        { rank: 22, userId: 'u-4', username: 'smith', score: 800 },
      ],
      totalPlayers: 2,
      topScore: 900,
      userRank: null,
    });

    render(<RankingsPage />);

    expect(await screen.findByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('#22')).toBeInTheDocument();
  });

  it('mantiene comportamiento previo por índice cuando el flag está desactivado', async () => {
    vi.stubEnv('VITE_RANKING_USE_BACKEND_RANK', 'false');
    vi.resetModules();
    const { RankingsPage } = await import('../pages/RankingsPage');

    mocks.getLeaderboard.mockResolvedValue({
      leaderboard: [
        { rank: 40, userId: 'u-1', username: 'neo', score: 1200 },
        { rank: 41, userId: 'u-2', username: 'trinity', score: 1100 },
      ],
      totalPlayers: 2,
      topScore: 1200,
      userRank: { rank: 40, score: 1200 },
    });

    render(<RankingsPage />);

    await waitFor(() => {
      expect(screen.getByText('🥇')).toBeInTheDocument();
      expect(screen.getByText('🥈')).toBeInTheDocument();
    });
    expect(screen.queryByText('#40')).not.toBeInTheDocument();
    expect(mocks.getMyRank).not.toHaveBeenCalled();
  });

  it('usa fallback diferido a /leaderboard/me cuando /leaderboard no trae userRank', async () => {
    vi.stubEnv('VITE_RANKING_USE_BACKEND_RANK', 'true');
    vi.stubEnv('VITE_RANKING_NEIGHBORS_ENABLED', 'false');
    vi.resetModules();
    const { RankingsPage } = await import('../pages/RankingsPage');

    mocks.getLeaderboard.mockResolvedValue({
      leaderboard: [
        { rank: 51, userId: 'u-1', username: 'neo', score: 1200 },
        { rank: 52, userId: 'u-2', username: 'trinity', score: 1100 },
      ],
      totalPlayers: 2,
      topScore: 1200,
      userRank: null,
    });

    mocks.getMyRank.mockResolvedValue({
      userRank: { rank: 77, userId: 'u-1', username: 'neo', score: 987, isCurrentUser: true },
      neighbors: [],
    });

    render(<RankingsPage />);

    expect(await screen.findByText('#77')).toBeInTheDocument();
    expect(screen.getByText('987 pts')).toBeInTheDocument();
    expect(mocks.getMyRank).toHaveBeenCalledTimes(1);
  });

  it('carga vecinos con feature flag sin bloquear el leaderboard', async () => {
    vi.stubEnv('VITE_RANKING_USE_BACKEND_RANK', 'true');
    vi.stubEnv('VITE_RANKING_NEIGHBORS_ENABLED', 'true');
    vi.resetModules();
    const { RankingsPage } = await import('../pages/RankingsPage');

    mocks.getLeaderboard.mockResolvedValue({
      leaderboard: [{ rank: 1, userId: 'u-1', username: 'neo', score: 1200 }],
      totalPlayers: 1,
      topScore: 1200,
      userRank: { rank: 1, score: 1200 },
    });

    mocks.getMyRank.mockResolvedValue({
      userRank: { rank: 1, userId: 'u-1', username: 'neo', score: 1200, isCurrentUser: true },
      neighbors: [{ rank: 2, userId: 'u-2', username: 'trinity', score: 1100 }],
    });

    render(<RankingsPage />);

    expect(await screen.findByText('🥇')).toBeInTheDocument();
    expect(await screen.findByText('Contexto cercano')).toBeInTheDocument();
    expect(await screen.findByText('#2 trinity')).toBeInTheDocument();
    expect(mocks.getMyRank).toHaveBeenCalledTimes(1);
  });

  it('usa métricas globales del backend en stats y muestra estado filtrado por búsqueda', async () => {
    vi.stubEnv('VITE_RANKING_USE_BACKEND_RANK', 'true');
    vi.resetModules();
    const { RankingsPage } = await import('../pages/RankingsPage');

    mocks.getLeaderboard.mockResolvedValue({
      leaderboard: [
        { rank: 1, userId: 'u-1', username: 'neo', score: 1200 },
        { rank: 2, userId: 'u-2', username: 'trinity', score: 1100 },
      ],
      totalPlayers: 999,
      topScore: 7777,
      avgScore: null,
      userRank: { rank: 1, score: 1200 },
    });

    render(<RankingsPage />);

    expect(await screen.findByText('999')).toBeInTheDocument();
    expect(screen.getByText('7,777')).toBeInTheDocument();
    expect(screen.queryByText('rankings.avgScore')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('common.search'), { target: { value: 'neo' } });

    expect(await screen.findByText(/Resultados filtrados:/i)).toBeInTheDocument();
    expect(screen.getByText('Filtrado por búsqueda')).toBeInTheDocument();
  });

  it('muestra estado noSearchResults cuando hay datos globales pero sin coincidencias en búsqueda', async () => {
    vi.stubEnv('VITE_RANKING_USE_BACKEND_RANK', 'true');
    vi.resetModules();
    const { RankingsPage } = await import('../pages/RankingsPage');

    mocks.getLeaderboard.mockResolvedValue({
      leaderboard: [{ rank: 1, userId: 'u-1', username: 'neo', score: 1200 }],
      totalPlayers: 1,
      topScore: 1200,
      userRank: { rank: 1, score: 1200 },
    });

    render(<RankingsPage />);

    expect(await screen.findByText('🥇')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('common.search'), { target: { value: 'smith' } });

    expect(await screen.findByText('rankings.noSearchResults')).toBeInTheDocument();
    expect(screen.queryByText('rankings.empty')).not.toBeInTheDocument();
  });
});
