import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChallengesPage } from '../pages/ChallengesPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: any }) => <a>{children}</a>,
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [mocks.searchParams, vi.fn()],
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
    mocks.searchParams = new URLSearchParams();
    mocks.apiGet.mockResolvedValue({ challenges: [] });
  });


  it('muestra una llamada clara para crear desafío multijugador', async () => {
    render(<ChallengesPage />);

    expect(await screen.findByText('challenges.createMultiplayerTitle')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'challenges.createMultiplayerCta' }).length).toBeGreaterThan(0);
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


  it('muestra estado de espera y bloquea jugar hasta completar el cupo', async () => {
    mocks.apiGet.mockResolvedValue({
      challenges: [
        {
          id: 'c2',
          status: 'PENDING',
          categories: ['MAP'],
          maxPlayers: 4,
          answerTimeSeconds: 20,
          participantsCount: 2,
          isJoinable: false,
          isUserParticipant: true,
          winnerId: null,
          createdAt: new Date().toISOString(),
          creator: { id: 'u1', username: 'yo' },
          participants: [
            { userId: 'u1', score: null, user: { id: 'u1', username: 'yo' } },
            { userId: 'u2', score: null, user: { id: 'u2', username: 'ana' } },
          ],
        },
      ],
    });

    render(<ChallengesPage />);

    const waitingButton = await screen.findByRole('button', { name: 'challenges.waitingReady' });
    expect(waitingButton).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'challenges.play' })).not.toBeInTheDocument();
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

  it('respeta la categoría inicial enviada desde menú para parametrizar al crear', async () => {
    mocks.searchParams = new URLSearchParams('category=CAPITAL&openCreate=1');

    render(<ChallengesPage />);

    expect(await screen.findByText('challenges.createTitle')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'challenges.send' }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith('/challenges', {
        categories: ['CAPITAL'],
        maxPlayers: 2,
        answerTimeSeconds: 20,
      });
    });
  });
});
