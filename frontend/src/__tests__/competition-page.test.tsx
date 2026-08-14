import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompetitionPage } from '../pages/CompetitionPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getCompetitionOverview: vi.fn(),
  getCompetitionLeaderboard: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'common.back': 'Volver',
        'competition.title': 'Competición',
        'competition.subtitle': 'Pon a prueba tu geografía contra otros jugadores.',
        'competition.ranked': 'Ranked',
        'competition.leaderboard': 'Leaderboard',
        'competition.recent': 'Partidas ranked recientes',
        'competition.other': 'Otra competencia',
        'competition.findMatch': 'Buscar partida',
        'competition.emptyRecent': 'Tus partidas ranked aparecerán aquí.',
        'competition.emptyLeaderboard': 'Aún no hay jugadores con 5 partidas en esta ladder.',
        'competition.scoreRankings': 'Rankings de score',
        'competition.vs': `vs ${options?.opponent ?? ''}`,
        'competition.placementProgress': `${options?.played ?? 0} / ${options?.total ?? 5} partidas de calibración`,
        'competition.unranked': 'Sin rank público',
        'competition.ladders.CLASSIC': 'Classic Ranked',
        'competition.ladders.GEO_CHALLENGE': 'GeoRetos Ranked',
        'competition.shortLadders.CLASSIC': 'Classic',
        'competition.shortLadders.GEO_CHALLENGE': 'GeoRetos',
        'competition.ladderDesc.CLASSIC': 'MIXED · sin filtros',
        'competition.ladderDesc.GEO_CHALLENGE': 'Duelos GeoRetos',
        'competition.tiers.CALIBRATING': 'Calibrando',
        'competition.tiers.PATHFINDER': 'Trazarutas',
        'menu.compete.challenge': 'Desafío',
        'menu.compete.survival': 'Supervivencia',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../services/api', () => ({
  api: {
    getCompetitionOverview: mocks.getCompetitionOverview,
    getCompetitionLeaderboard: mocks.getCompetitionLeaderboard,
  },
}));

describe('CompetitionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCompetitionOverview.mockResolvedValue({
      ladders: {
        CLASSIC: {
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
        GEO_CHALLENGE: {
          rating: 1084,
          peakRating: 1084,
          gamesPlayed: 12,
          wins: 8,
          draws: 2,
          losses: 2,
          provisional: false,
          placementGamesRemaining: 0,
          rank: 12,
          tier: 'PATHFINDER',
        },
      },
      recentMatches: [
        {
          duelMatchId: 'dm1',
          ladder: 'CLASSIC',
          opponent: { id: 'u2', username: 'Laura' },
          result: 'win',
          ratingBefore: 1000,
          ratingDelta: 16,
          ratingAfter: 1016,
          createdAt: '2026-08-14T00:00:00Z',
        },
      ],
    });
    mocks.getCompetitionLeaderboard.mockResolvedValue({
      ladder: 'CLASSIC',
      leaderboard: [
        {
          rank: 1,
          userId: 'u1',
          username: 'Felipe',
          rating: 1100,
          tier: 'PATHFINDER',
          gamesPlayed: 7,
          wins: 5,
          draws: 1,
          losses: 1,
        },
      ],
      me: {
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
    });
  });

  it('renders both ladders and routes ranked buttons exactly', async () => {
    render(
      <MemoryRouter>
        <CompetitionPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Classic Ranked')).toBeInTheDocument();
    expect(screen.getByText('GeoRetos Ranked')).toBeInTheDocument();
    expect(screen.getByText('0 / 5 partidas de calibración')).toBeInTheDocument();
    expect(screen.getByText('#12')).toBeInTheDocument();
    expect(screen.getByText('vs Laura')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button', { name: 'Buscar partida' });
    fireEvent.click(buttons[0]);
    expect(mocks.navigate).toHaveBeenCalledWith('/duel?rated=1&category=MIXED');

    fireEvent.click(buttons[1]);
    expect(mocks.navigate).toHaveBeenCalledWith('/duel?rated=1&mode=geo-challenge');

    await waitFor(() => {
      expect(mocks.getCompetitionLeaderboard).toHaveBeenCalledWith('CLASSIC');
    });
  });
});
