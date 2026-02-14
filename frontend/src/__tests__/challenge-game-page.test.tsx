import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChallengeGamePage } from '../pages/ChallengeGamePage';

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  apiGetMock: vi.fn(),
  apiPostMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigateMock,
  useParams: () => ({ id: 'challenge-1' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../services/api', () => ({
  api: {
    get: mocks.apiGetMock,
    post: mocks.apiPostMock,
  },
}));

vi.mock('../components', () => ({
  Timer: () => <div>timer</div>,
  QuestionCard: () => <div>question-card</div>,
  OptionButton: ({ option }: { option: string }) => <button>{option}</button>,
  ScoreDisplay: () => <div>score</div>,
  ProgressBar: () => <div>progress</div>,
  LoadingSpinner: ({ text }: { text?: string }) => <div>{text || 'loading'}</div>,
}));

describe('ChallengeGamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiGetMock.mockResolvedValue({
      questions: [
        {
          id: 'q1',
          questionText: 'Capital de Chile',
          options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
          correctAnswer: 'Santiago',
          category: 'CAPITAL',
        },
      ],
    });
  });

  it('renderiza alternativas en grilla de dos columnas para reducir scroll en mobile', async () => {
    render(<ChallengeGamePage />);

    const firstOption = await screen.findByRole('button', { name: 'Santiago' });
    const optionsGrid = firstOption.parentElement;

    expect(optionsGrid).toHaveClass('grid');
    expect(optionsGrid).toHaveClass('grid-cols-2');

    await waitFor(() => {
      expect(mocks.apiGetMock).toHaveBeenCalledWith('/challenges/challenge-1/questions');
    });
  });
});
