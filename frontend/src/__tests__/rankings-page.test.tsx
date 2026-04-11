import { render, screen, waitFor } from '@testing-library/react';
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
    mocks.getMyRank.mockResolvedValue({ userRank: null });
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
      userRank: null,
    });

    render(<RankingsPage />);

    expect(await screen.findByText('#11')).toBeInTheDocument();
    expect(screen.getByText('#15')).toBeInTheDocument();
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
      userRank: null,
    });

    render(<RankingsPage />);

    await waitFor(() => {
      expect(screen.getByText('🥇')).toBeInTheDocument();
      expect(screen.getByText('🥈')).toBeInTheDocument();
    });
    expect(screen.queryByText('#40')).not.toBeInTheDocument();
  });
});
