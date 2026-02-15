import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChallengeResultsPage } from '../pages/ChallengeResultsPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  state: null as any,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => mocks.navigate,
  useParams: () => ({ id: 'challenge-1' }),
  useLocation: () => ({ state: mocks.state }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ChallengeResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state = null;
  });

  it('muestra fallback usable si se abre sin estado de resultados', () => {
    render(<ChallengeResultsPage />);

    expect(screen.getByText('challenges.resultsUnavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'challenges.backToList' })).toBeInTheDocument();
  });

  it('muestra resumen de resultado cuando recibe estado válido', () => {
    mocks.state = { score: 1234, correctAnswers: 7, totalQuestions: 10 };
    render(<ChallengeResultsPage />);

    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'challenges.playAgain' })).toBeInTheDocument();
  });
});
