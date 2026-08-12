import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockGameState = vi.hoisted(() => {
  let _state: any = null;
  return {
    setState: (s: any) => { _state = s; },
    getState: () => _state,
  };
});

vi.mock('../context/GameContext', () => {
  const ctx = {
    state: {
      status: 'finished',
      questions: [{ id: 'q1', category: 'FLAG', questionText: 'Q', options: ['A', 'B', 'C', 'D'], difficulty: 'MEDIUM' }],
      currentIndex: 0,
      answers: [],
      results: [{ questionId: 'q1', isCorrect: true, correctAnswer: 'A', userAnswer: 'A', points: 100 }],
      score: 100,
      timeRemaining: 0,
      config: { questionsCount: 1, timePerQuestion: 10, category: 'MIXED', gameType: 'practice', mechanics: { enabled: false, allowed: [], limits: {} } },
      isOffline: false,
    },
    streakAlive: true,
    startGame: vi.fn(),
    startPractice: vi.fn(),
    appendQuestions: vi.fn(),
    setStreakAlive: vi.fn(),
    submitAnswer: vi.fn(),
    nextQuestion: vi.fn(),
    finishGame: vi.fn(),
    resetGame: vi.fn(),
    setTimeRemaining: vi.fn(),
    replaceCurrentQuestion: vi.fn(),
    lastNewAchievements: [],
  };
  return {
    useGame: () => ctx,
    GameProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

vi.mock('../services/api', () => ({
  api: {
    getMyRank: vi.fn().mockResolvedValue({ rank: 5, totalPlayers: 100 }),
  },
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

vi.mock('../hooks/useImagePreloader', () => ({
  useImagePreloader: () => {},
}));

vi.mock('../hooks/useStreakShareImage', () => ({
  useStreakShareImage: () => ({ share: vi.fn(), status: 'idle' }),
}));

vi.mock('../utils/achievements', () => ({
  getAchievementDisplay: () => null,
}));

import { ResultsPage } from '../pages/ResultsPage';

describe('ResultsPage — practice mode', () => {
  it('shows practice title', async () => {
    render(
      <MemoryRouter initialEntries={['/results?gameType=practice']}>
        <ResultsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('results.practiceTitle')).toBeDefined();
    });
  });

  it('shows continue practicing button', async () => {
    render(
      <MemoryRouter initialEntries={['/results?gameType=practice']}>
        <ResultsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('results.continuePractice')).toBeDefined();
    });
  });

  it('shows view passport button', async () => {
    render(
      <MemoryRouter initialEntries={['/results?gameType=practice']}>
        <ResultsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('results.viewPassport')).toBeDefined();
    });
  });

  it('does not show rankings button in practice mode', async () => {
    render(
      <MemoryRouter initialEntries={['/results?gameType=practice']}>
        <ResultsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('results.viewPassport')).toBeDefined();
    });

    expect(screen.queryByText('results.viewRankings')).toBeNull();
  });
});
