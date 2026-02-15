import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChallengesPage } from '../pages/ChallengesPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: any }) => <a>{children}</a>,
  useNavigate: () => mocks.navigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('../services/api', () => ({
  api: {
    get: mocks.apiGet,
    post: mocks.apiPost,
  },
}));

describe('ChallengesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiGet.mockResolvedValue({ challenges: [] });
  });

  it('crea desafíos multijugador con categorías, cupo y tiempo', async () => {
    render(<ChallengesPage />);

    fireEvent.click(await screen.findByRole('button', { name: /\+ challenges.create/i }));

    fireEvent.click(screen.getByRole('button', { name: '10s' }));
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: 'categories.flags' }));

    fireEvent.click(screen.getByRole('button', { name: 'challenges.send' }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith('/challenges', {
        categories: ['FLAG'],
        maxPlayers: 4,
        answerTimeSeconds: 10,
      });
    });
  });

  it('permite unirse a una convocatoria abierta desde la pestaña para unirme', async () => {
    mocks.apiGet.mockResolvedValue({
      challenges: [
        {
          id: 'c1',
          status: 'PENDING',
          categories: ['MAP', 'FLAG'],
          maxPlayers: 4,
          answerTimeSeconds: 30,
          participantsCount: 2,
          isJoinable: true,
          isUserParticipant: false,
          winnerId: null,
          createdAt: new Date().toISOString(),
          creator: { id: 'u2', username: 'ana' },
          participants: [
            { userId: 'u2', score: null, user: { id: 'u2', username: 'ana' } },
            { userId: 'u3', score: null, user: { id: 'u3', username: 'max' } },
          ],
        },
      ],
    });

    render(<ChallengesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'challenges.tabs.joinable' }));
    fireEvent.click(await screen.findByRole('button', { name: 'challenges.join' }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith('/challenges/c1/join');
    });
  });
});
