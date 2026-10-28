import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameConfig } from '../types';
import { ResultsPage } from '../pages/ResultsPage';

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  search: '',
  resetGameMock: vi.fn(),
  getMyRankMock: vi.fn().mockResolvedValue({ userRank: { rank: 1 } }),
  writeTextMock: vi.fn().mockResolvedValue(undefined),
  gameState: {
    config: null as GameConfig | null,
    score: 1100,
    questions: new Array(10).fill(null).map((_, index) => ({ id: `q${index}`, category: 'CAPITAL', questionData: 'Chile', questionText: 'Capital', options: [] })),
    results: [
      ...new Array(8).fill(null).map((_, index) => ({ questionId: `q${index}`, isCorrect: true, correctAnswer: 'Santiago', userAnswer: 'Santiago' })),
      ...new Array(2).fill(null).map((_, index) => ({ questionId: `q${index + 8}`, isCorrect: false, correctAnswer: 'Santiago', userAnswer: 'Lima' })),
    ],
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigateMock,
  useSearchParams: () => [new URLSearchParams(mocks.search)],
  Navigate: ({ to }: { to: string }) => <div data-testid="redirect">{to}</div>,
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'app.name': 'GeoChallenge',
        'game.score': 'Puntuación',
        'results.gameOver': '¡Partida terminada!',
        'results.great': '¡Muy bien!',
        'results.excellent': '¡Excelente!',
        'results.good': '¡Bien hecho!',
        'results.keepPracticing': '¡Sigue practicando!',
        'results.tryAgain': '¡Puedes hacerlo mejor!',
        'results.points': 'puntos',
        'results.correct': 'Correctas',
        'results.incorrect': 'Incorrectas',
        'results.accuracy': 'Precisión',
        'results.averageTime': 'Tiempo medio por respuesta',
        'results.categoryAccuracyTitle': 'Precisión por categoría',
        'results.categoryAccuracyDescription': 'Así se reparten tus aciertos por tipo de pregunta.',
        'results.funFactLabel': 'Dato curioso',
        'categories.flags': 'Banderas',
        'categories.capitals': 'Capitales',
        'results.yourRank': 'Tu posición',
        'results.playAgain': 'Jugar de nuevo',
        'results.viewRankings': 'Ver rankings',
        'results.shareScore': 'Comparte tu puntuación',
        'results.shareButton': 'Compartir resultado',
        'results.copied': '¡Resultado listo para compartir!',
        'share.shared': '¡Compartido!',
        'share.copied': 'Copiado al portapapeles',
        'share.error': 'No se pudo compartir',
        'common.backToMenu': 'Volver al menú',
        'common.loading': 'Cargando',
        'rankings.empty': 'Aún no hay jugadores en el ranking',
      };

      if (key === 'results.shareText') {
        return `🎯 ${options?.score} pts ${options?.correct}/${options?.total} (${options?.accuracy})`;
      }

      if (key === 'results.categoryAccuracyValue') {
        return `${options?.correct} de ${options?.total} · ${options?.accuracy}%`;
      }

      if (key === 'results.averageTimeValue') {
        return `${options?.seconds} s`;
      }

      if (key === 'results.practiceWeakest') {
        return `Practicar ${options?.category}`;
      }

      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    state: mocks.gameState,
    resetGame: mocks.resetGameMock,
    lastNewAchievements: [],
  }),
}));

vi.mock('../services/api', () => ({
  api: {
    getMyRank: () => mocks.getMyRankMock(),
  },
}));

vi.mock('../components', async () => {
  const actual = await vi.importActual<typeof import('../components')>('../components');
  return {
    ...actual,
    LoadingSpinner: () => <div>loading</div>,
  };
});

describe('ResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = '';
    mocks.gameState.config = null;
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(mocks.writeTextMock);
  });

  it('prioriza el resultado y mantiene métricas secundarias en una sola composición', async () => {
    const { container } = render(<ResultsPage />);

    await waitFor(() => {
      expect(mocks.getMyRankMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('8 / 10')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('1,100')).toBeInTheDocument();
    expect(container.querySelectorAll('article.min-w-0').length).toBe(0);
    expect(screen.queryByText(/Tiempo medio por respuesta/)).not.toBeInTheDocument();
  });

  it('lleva el foco al titular del resumen al entrar', async () => {
    render(<ResultsPage />);

    const heading = screen.getByRole('heading', { level: 1 });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('muestra el tiempo medio por respuesta cuando la sesión trae tiempos', () => {
    const originalResults = mocks.gameState.results;
    mocks.gameState.results = originalResults.map((result, index) => ({
      ...result,
      elapsedSeconds: index < 5 ? 4 : 8,
    })) as typeof mocks.gameState.results;

    try {
      render(<ResultsPage />);

      expect(screen.getByText(/Tiempo medio por respuesta/)).toBeInTheDocument();
      expect(screen.getByText('6 s')).toBeInTheDocument();
    } finally {
      mocks.gameState.results = originalResults;
    }
  });

  it.each(['single', 'streak', 'practice'] as const)('replays %s with the same configuration', async (gameType) => {
    mocks.search = `gameType=${gameType}&category=FLAG&continent=Europe&difficulty=HARD&isLandlocked=true&countryCode=CL`;
    mocks.gameState.config = { gameType, category: 'FLAG', questionsCount: 10, timePerQuestion: 10 };
    render(<ResultsPage />);
    const tray = screen.getByTestId('results-action-tray');
    const primary = tray.querySelector('button')!;
    fireEvent.click(primary);
    expect(mocks.resetGameMock).toHaveBeenCalledOnce();
    expect(mocks.navigateMock).toHaveBeenCalledWith(`/game/single?category=FLAG&gameType=${gameType}&continent=Europe&difficulty=HARD&isLandlocked=true&countryCode=CL`);
    if (gameType === 'practice') {
      expect(mocks.getMyRankMock).not.toHaveBeenCalled();
      expect(screen.queryByText('Jugar de nuevo')).not.toBeInTheDocument();
    }
  });

  it('places replay before review and sharing, and shows actual missed answers', () => {
    render(<ResultsPage />);
    const tray = screen.getByTestId('results-action-tray');
    const review = screen.getByRole('heading', { name: 'results.reviewTitle' });
    expect(tray.compareDocumentPosition(review) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelectorAll('details')).toHaveLength(2);
    expect(screen.getAllByText('Lima')).toHaveLength(2);
    expect(screen.getAllByText('Santiago')).toHaveLength(2);
  });

  it('incluye el dato curioso en el detalle de un fallo', () => {
    const originalQuestions = mocks.gameState.questions;
    const originalResults = mocks.gameState.results;
    mocks.gameState.questions = [
      {
        id: 'q1',
        category: 'CAPITAL',
        questionData: 'Chile',
        continent: 'South America',
        questionText: 'Capital',
        options: [],
      },
    ] as unknown as typeof mocks.gameState.questions;
    mocks.gameState.results = [
      { questionId: 'q1', isCorrect: false, correctAnswer: 'Santiago', userAnswer: 'Lima' },
    ] as typeof mocks.gameState.results;

    try {
      render(<ResultsPage />);

      expect(screen.getByText('Dato curioso')).toBeInTheDocument();
      expect(screen.getByText('Chile se encuentra en América del Sur.')).toBeInTheDocument();
    } finally {
      mocks.gameState.questions = originalQuestions;
      mocks.gameState.results = originalResults;
    }
  });

  it('muestra la categoría en cada fallo del repaso', () => {
    render(<ResultsPage />);

    expect(screen.getAllByText('Capitales')).toHaveLength(2);
  });

  it('no revela la respuesta correcta en el resumen del repaso', () => {
    render(<ResultsPage />);

    const summaries = Array.from(document.querySelectorAll('summary')).map((summary) => summary.textContent ?? '');
    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries.join(' ')).not.toContain('Santiago');
  });

  it('keeps trial replay public and does not request a private ranking', () => {
    render(<ResultsPage isTrial />);
    fireEvent.click(screen.getByRole('button', { name: 'Jugar de nuevo' }));
    expect(mocks.navigateMock).toHaveBeenCalledWith('/play');
    expect(mocks.getMyRankMock).not.toHaveBeenCalled();
    expect(screen.getByText('results.trialNotice')).toBeInTheDocument();
  });

  it('copia mensaje y muestra confirmación inline; action tray en flujo natural (no sticky)', async () => {
    render(<ResultsPage />);

    fireEvent.click(screen.getByRole('button', { name: /compartir resultado/i }));

    await waitFor(() => {
      expect(mocks.writeTextMock).toHaveBeenCalledWith('🎯 1100 pts 8/10 (80%)');
    });

    expect(screen.getByText('Copiado al portapapeles')).toBeInTheDocument();
    // QA round 3 (issue: action tray sticky se montaba sobre el contenido y el
    // backdrop-blur dejaba ver algo por detrás al scrollear). Ahora va en flow
    // natural al final del documento — la página entera es scroll vertical.
    expect(screen.getByTestId('results-action-tray')).not.toHaveClass('sticky');
    expect(screen.getByTestId('results-action-tray')).not.toHaveClass('backdrop-blur-sm');
  });

  it('no muestra precisión por categoría cuando solo hay una', async () => {
    render(<ResultsPage />);

    expect(screen.queryByRole('heading', { name: 'Precisión por categoría' })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.getMyRankMock).toHaveBeenCalled());
  });

  it('resume la precisión por categoría cuando hay al menos dos', async () => {
    const originalQuestions = mocks.gameState.questions;
    const originalResults = mocks.gameState.results;
    mocks.gameState.questions = [
      { id: 'flag-1', category: 'FLAG', questionData: 'Chile', questionText: 'Bandera', options: [] },
      { id: 'flag-2', category: 'FLAG', questionData: 'Perú', questionText: 'Bandera', options: [] },
      { id: 'cap-1', category: 'CAPITAL', questionData: 'Chile', questionText: 'Capital', options: [] },
      { id: 'cap-2', category: 'CAPITAL', questionData: 'Perú', questionText: 'Capital', options: [] },
    ] as typeof mocks.gameState.questions;
    mocks.gameState.results = [
      { questionId: 'flag-1', isCorrect: true, correctAnswer: 'Chile', userAnswer: 'Chile' },
      { questionId: 'flag-2', isCorrect: false, correctAnswer: 'Perú', userAnswer: 'Chile' },
      { questionId: 'cap-1', isCorrect: true, correctAnswer: 'Santiago', userAnswer: 'Santiago' },
      { questionId: 'cap-2', isCorrect: true, correctAnswer: 'Lima', userAnswer: 'Lima' },
    ] as typeof mocks.gameState.results;

    try {
      render(<ResultsPage />);

      const section = screen.getByRole('heading', { name: 'Precisión por categoría' }).closest('section')!;
      expect(within(section).getByText('Banderas')).toBeInTheDocument();
      expect(within(section).getByText('Capitales')).toBeInTheDocument();
      expect(screen.getByText('1 de 2 · 50%')).toBeInTheDocument();
      expect(screen.getByText('2 de 2 · 100%')).toBeInTheDocument();

      fireEvent.click(within(section).getByRole('button', { name: 'Practicar Banderas' }));
      expect(mocks.resetGameMock).toHaveBeenCalledOnce();
      expect(mocks.navigateMock).toHaveBeenCalledWith('/game/single?category=FLAG&gameType=single');

      await waitFor(() => expect(mocks.getMyRankMock).toHaveBeenCalled());
    } finally {
      mocks.gameState.questions = originalQuestions;
      mocks.gameState.results = originalResults;
    }
  });

  it('deshabilita compartir mientras está en progreso para evitar toques dobles', async () => {
    let resolveShare: () => void = () => {};
    mocks.writeTextMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveShare = resolve;
        })
    );

    render(<ResultsPage />);

    const shareButton = screen.getByRole('button', { name: /compartir resultado/i });
    fireEvent.click(shareButton);

    expect(shareButton).toBeDisabled();
    expect(screen.getByRole('button', { name: /cargando/i })).toBeInTheDocument();

    resolveShare();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /compartir resultado/i })).toBeEnabled();
    });
  });
});
