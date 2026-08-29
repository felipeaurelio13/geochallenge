import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockStartAdaptivePractice = vi.fn();
const mockStartGame = vi.fn();

vi.mock('../services/api', () => ({
  api: {
    startAdaptivePractice: (...args: any[]) => mockStartAdaptivePractice(...args),
    startGame: (...args: any[]) => mockStartGame(...args),
    submitAnswer: vi.fn(),
    finishGame: vi.fn(),
    extendSession: vi.fn(),
    useMechanic: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
    notifyQuestionStarted: vi.fn(),
  },
}));

vi.mock('../services/socket', () => ({
  socketService: { connect: vi.fn(), disconnect: vi.fn() },
}));

vi.mock('../hooks/useImagePreloader', () => ({
  useImagePreloader: () => {},
}));

vi.mock('../utils/uxTelemetry', () => ({
  trackUxEvent: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es' },
  }),
}));

import { GamePage } from '../pages/GamePage';
import { GameProvider } from '../context/GameContext';

describe('GamePage — practice mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls startAdaptivePractice when gameType=practice', async () => {
    mockStartAdaptivePractice.mockResolvedValue({
      sessionId: 'sess1',
      questions: [
        { id: 'q1', category: 'FLAG', questionText: 'Test?', options: ['A', 'B', 'C', 'D'], difficulty: 'MEDIUM', imageUrl: 'http://img' },
        { id: 'q2', category: 'FLAG', questionText: 'Test2?', options: ['A', 'B', 'C', 'D'], difficulty: 'MEDIUM', imageUrl: 'http://img' },
      ],
      gameConfig: {
        questionsCount: 2,
        timePerQuestion: 10,
        category: 'MIXED',
        gameType: 'practice',
        mechanics: { enabled: false, allowed: [], limits: {} },
      },
    });

    render(
      <MemoryRouter initialEntries={['/game/single?gameType=practice']}>
        <GameProvider>
          <GamePage />
        </GameProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockStartAdaptivePractice).toHaveBeenCalled();
    });
    expect(mockStartGame).not.toHaveBeenCalled();
  });

  it('does NOT use offline fallback for practice mode', async () => {
    mockStartAdaptivePractice.mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter initialEntries={['/game/single?gameType=practice']}>
        <GameProvider>
          <GamePage />
        </GameProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockStartAdaptivePractice).toHaveBeenCalled();
    });
  });

  it('recognizes countryCode param for focused practice', async () => {
    mockStartAdaptivePractice.mockResolvedValue({
      sessionId: 'sess1',
      questions: [{ id: 'q1', category: 'FLAG', questionText: 'Test?', options: ['A', 'B', 'C', 'D'], difficulty: 'MEDIUM', imageUrl: 'http://img' }],
      gameConfig: { questionsCount: 1, timePerQuestion: 10, category: 'MIXED', gameType: 'practice', mechanics: { enabled: false, allowed: [], limits: {} } },
    });

    render(
      <MemoryRouter initialEntries={['/game/single?gameType=practice&countryCode=CL']}>
        <GameProvider>
          <GamePage />
        </GameProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockStartAdaptivePractice).toHaveBeenCalledWith('CL');
    });
  });
});
