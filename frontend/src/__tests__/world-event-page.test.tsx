import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { WorldEventPage } from '../pages/WorldEventPage';
import { api } from '../services/api';

// Mock i18n
i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
});

// Mock api
vi.mock('../services/api', () => ({
  api: {
    getCurrentEvent: vi.fn(),
    startBoss: vi.fn(),
    bossAnswer: vi.fn(),
  },
}));

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock useAuth
vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: { id: '1', username: 'test', email: 'test@test.com' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const mockEventData = {
  event: {
    eventId: '2026-08-10',
    version: 'weekly-world-event-v1',
    region: 'AFRICA' as const,
    startsAt: '2026-08-10T00:00:00.000Z',
    endsAt: '2026-08-17T00:00:00.000Z',
  },
  progress: {
    correctInRegion: 5,
    correctRequired: 8,
    distinctCategories: 2,
    categoriesRequired: 3,
    dailyCompleted: false,
    bossUnlocked: false,
  },
  boss: {
    unlocked: false,
    cleared: false,
    attempts: 0,
    bestCorrect: 0,
    bestScore: 0,
    activeAttempt: null,
  },
  serverNow: new Date().toISOString(),
};

describe('WorldEventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(api.getCurrentEvent).mockImplementation(() => new Promise(() => {}));
    
    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <WorldEventPage />
        </I18nextProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows locked state when boss is not unlocked', async () => {
    vi.mocked(api.getCurrentEvent).mockResolvedValue(mockEventData);

    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <WorldEventPage />
        </I18nextProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Expedición/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Guardián bloqueado/)).toBeInTheDocument();
  });

  it('shows unlocked state when boss is unlocked', async () => {
    const unlockedData = {
      ...mockEventData,
      progress: {
        ...mockEventData.progress,
        correctInRegion: 8,
        distinctCategories: 3,
        dailyCompleted: true,
        bossUnlocked: true,
      },
      boss: {
        ...mockEventData.boss,
        unlocked: true,
      },
    };

    vi.mocked(api.getCurrentEvent).mockResolvedValue(unlockedData);

    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <WorldEventPage />
        </I18nextProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Enfrentar Guardián/)).toBeInTheDocument();
    });
  });

  it('shows cleared state when boss is defeated', async () => {
    const clearedData = {
      ...mockEventData,
      progress: {
        ...mockEventData.progress,
        correctInRegion: 8,
        distinctCategories: 3,
        dailyCompleted: true,
        bossUnlocked: true,
      },
      boss: {
        unlocked: true,
        cleared: true,
        attempts: 2,
        bestCorrect: 8,
        bestScore: 800,
        activeAttempt: null,
      },
    };

    vi.mocked(api.getCurrentEvent).mockResolvedValue(clearedData);

    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <WorldEventPage />
        </I18nextProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Guardián derrotado/)).toBeInTheDocument();
    });

    expect(screen.getByText(/8 \/ 10/)).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    vi.mocked(api.getCurrentEvent).mockRejectedValue(new Error('API Error'));

    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <WorldEventPage />
        </I18nextProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error al cargar el evento/)).toBeInTheDocument();
    });
  });
});
