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
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '4' } });
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
});
