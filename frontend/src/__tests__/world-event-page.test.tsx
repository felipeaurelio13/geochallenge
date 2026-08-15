import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { WorldEventPage } from '../pages/WorldEventPage';
import { api } from '../services/api';

// Mock useTranslation with the real Spanish strings used by WorldEventPage.
// NOTE: t must be a stable function (like i18next's) so effects keyed on `[t]`
// don't re-run on every render.
const translations: Record<string, string> = {
  'worldEvent.region.AFRICA': 'África',
  'worldEvent.expedition': 'Expedición {{region}}',
  'worldEvent.endsIn': 'Termina en {{time}}',
  'worldEvent.finished': 'Terminado',
  'worldEvent.preparation': 'Preparación',
  'worldEvent.correctAnswers': '{{count}} / {{required}} respuestas correctas',
  'worldEvent.challengeTypes': '{{count}} / {{required}} tipos de desafío',
  'worldEvent.dailyCompleted': 'Daily completado',
  'worldEvent.guardianLocked': 'Guardián bloqueado',
  'worldEvent.guardianLockedDesc': 'Completa la preparación para desafiarlo.',
  'worldEvent.guardianDefeated': 'Guardián derrotado',
  'worldEvent.guardianAvailable': 'Guardián disponible',
  'worldEvent.guardianUnlocked': 'Guardián desbloqueado',
  'worldEvent.guardianResists': 'El Guardián Resiste',
  'worldEvent.bossDescription': '10 preguntas. Necesitas 7 golpes para derrotarlo.',
  'worldEvent.practiceRegion': 'Practicar {{region}}',
  'worldEvent.playAgain': 'Jugar otra vez',
  'worldEvent.faceGuardian': 'Enfrentar Guardián',
  'worldEvent.best': 'Mejor: {{correct}} / 10',
  'worldEvent.attempts': '{{count}} intento',
  'worldEvent.attemptsPlural': '{{count}} intentos',
  'worldEvent.bossTitle': 'Guardián de {{region}}',
  'worldEvent.question': 'Pregunta {{current}} / {{total}}',
  'worldEvent.correctFeedback': '¡Correcto! +{{points}}',
  'worldEvent.incorrectFeedback': 'Incorrecto',
  'worldEvent.answerWas': 'Respuesta: {{answer}}',
  'worldEvent.scoreLine': 'Score: {{score}} | Golpes: {{hits}} / {{required}}',
  'worldEvent.greatWork': '¡Excelente trabajo!',
  'worldEvent.tryAgain': 'Prepárate y vuelve a intentarlo.',
  'worldEvent.backToMenu': 'Volver al menú',
  'worldEvent.backToJourney': 'Volver al viaje',
  'worldEvent.errorLoading': 'Error al cargar el evento',
  'worldEvent.errorStart': 'Error al iniciar el Boss',
  'worldEvent.errorNext': 'Error al cargar siguiente pregunta',
  'worldEvent.errorAnswer': 'Error al enviar respuesta',
};

function translate(key: string, options?: Record<string, unknown>): string {
  const template = translations[key] ?? key;
  if (!options) return template;
  return Object.entries(options).reduce(
    (acc, [optKey, optValue]) => acc.replace(`{{${optKey}}}`, String(optValue ?? '')),
    template,
  );
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate }),
}));

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

const question = {
  questionId: 'q1',
  category: 'CAPITAL' as const,
  questionText: '¿Cuál es la capital de Kenya?',
  options: ['Nairobi', 'Lagos', 'El Cairo', 'Adís Abeba'],
  imageUrl: null,
  questionData: 'x',
  difficulty: null,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <WorldEventPage />
    </MemoryRouter>,
  );
}

describe('WorldEventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading state initially', () => {
    vi.mocked(api.getCurrentEvent).mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows locked state when boss is not unlocked', async () => {
    vi.mocked(api.getCurrentEvent).mockResolvedValue(mockEventData);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Expedición/)).toBeInTheDocument();
    });

    expect(screen.getByText('Guardián bloqueado')).toBeInTheDocument();
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

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Enfrentar Guardián')).toBeInTheDocument();
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

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Guardián derrotado')).toBeInTheDocument();
    });

    expect(screen.getByText(/8 \/ 10/)).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    vi.mocked(api.getCurrentEvent).mockRejectedValue(new Error('API Error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Error al cargar el evento')).toBeInTheDocument();
    });
  });

  it('resume shows live progress from server (questionIndex + 1)', async () => {
    vi.mocked(api.getCurrentEvent).mockResolvedValue({
      ...mockEventData,
      progress: {
        correctInRegion: 8,
        correctRequired: 8,
        distinctCategories: 3,
        categoriesRequired: 3,
        dailyCompleted: true,
        bossUnlocked: true,
      },
      boss: {
        unlocked: true,
        cleared: false,
        attempts: 0,
        bestCorrect: 0,
        bestScore: 0,
        activeAttempt: { id: 'a1', currentQuestionIndex: 2, expiresAt: '2026-08-17T00:00:00.000Z' },
      },
    });
    vi.mocked(api.startBoss).mockResolvedValue({
      resumed: true,
      attemptId: 'a1',
      eventId: '2026-08-10',
      region: 'AFRICA',
      questionIndex: 2,
      totalQuestions: 10,
      correctCount: 2,
      score: 200,
      expiresAt: '2026-08-17T00:00:00.000Z',
      question,
      timeLimit: 20,
      boss: { hitsRequired: 7, hits: 2 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Enfrentar Guardián')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Enfrentar Guardián'));

    // Progress uses questionIndex + 1, NOT answered count
    await waitFor(() => {
      expect(screen.getByText('Pregunta 3 / 10')).toBeInTheDocument();
    });

    // Score and hits come from the server state
    expect(screen.getByText('Score: 200 | Golpes: 2 / 7')).toBeInTheDocument();

    // Boss hearts reflect hits from server (2 hits landed → 5 remaining)
    const hearts = screen.getAllByText('❤️');
    expect(hearts).toHaveLength(7);
    hearts.slice(0, 5).forEach((h) => expect(h.className).toContain('opacity-100'));
    hearts.slice(5).forEach((h) => expect(h.className).toContain('opacity-30'));
  });

  it('answer syncs correctCount/score/bossHp from server', async () => {
    vi.mocked(api.getCurrentEvent).mockResolvedValue({
      ...mockEventData,
      progress: {
        correctInRegion: 8,
        correctRequired: 8,
        distinctCategories: 3,
        categoriesRequired: 3,
        dailyCompleted: true,
        bossUnlocked: true,
      },
      boss: {
        unlocked: true,
        cleared: false,
        attempts: 0,
        bestCorrect: 0,
        bestScore: 0,
        activeAttempt: null,
      },
    });
    vi.mocked(api.startBoss).mockResolvedValue({
      resumed: false,
      attemptId: 'a1',
      eventId: '2026-08-10',
      region: 'AFRICA',
      questionIndex: 0,
      totalQuestions: 10,
      correctCount: 0,
      score: 0,
      expiresAt: '2026-08-17T00:00:00.000Z',
      question,
      timeLimit: 20,
      boss: { hitsRequired: 7, hits: 0 },
    });
    vi.mocked(api.bossAnswer).mockResolvedValue({
      questionId: 'q1',
      isCorrect: true,
      points: 100,
      correctAnswer: 'Nairobi',
      questionIndex: 0,
      nextQuestionIndex: 1,
      correctCount: 3,
      score: 300,
      totalQuestions: 10,
      isFinal: false,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Enfrentar Guardián')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Enfrentar Guardián'));
    await waitFor(() => {
      expect(screen.getByText('Pregunta 1 / 10')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nairobi'));

    // Server truth wins: score/hits reflect the answer response, not local counters
    await waitFor(() => {
      expect(screen.getByText('Score: 300 | Golpes: 3 / 7')).toBeInTheDocument();
    });
  });
});