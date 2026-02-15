import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultsPage } from '../pages/ResultsPage';

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  resetGameMock: vi.fn(),
  getMyRankMock: vi.fn().mockResolvedValue({ userRank: { rank: 1 } }),
  writeTextMock: vi.fn().mockResolvedValue(undefined),
  gameState: {
    score: 1100,
    questions: new Array(10).fill(null).map((_, index) => ({ id: `q${index}` })),
    results: [
      ...new Array(8).fill(null).map(() => ({ isCorrect: true })),
      ...new Array(2).fill(null).map(() => ({ isCorrect: false })),
    ],
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigateMock,
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'app.name': 'GeoChallenge',
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
        'results.yourRank': 'Tu posición',
        'results.playAgain': 'Jugar de nuevo',
        'results.viewRankings': 'Ver rankings',
        'results.shareScore': 'Comparte tu puntuación',
        'results.shareButton': 'Compartir resultado',
        'results.copied': '¡Resultado listo para compartir!',
        'common.backToMenu': 'Volver al menú',
      };

      if (key === 'results.shareText') {
        return `🎯 ${options?.score} pts ${options?.correct}/${options?.total} (${options?.accuracy})`;
      }

      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    state: mocks.gameState,
    resetGame: mocks.resetGameMock,
  }),
}));

vi.mock('../services/api', () => ({
  api: {
    getMyRank: () => mocks.getMyRankMock(),
  },
}));

vi.mock('../components', () => ({
  LoadingSpinner: () => <div>loading</div>,
}));

describe('ResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(mocks.writeTextMock);
  });

  it('mantiene badges contenidos en tarjetas y muestra botón de compartir mejorado', async () => {
    const { container } = render(<ResultsPage />);

    await waitFor(() => {
      expect(mocks.getMyRankMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Correctas').parentElement).toHaveClass('w-full', 'justify-center');
    expect(screen.getByText('Incorrectas').parentElement).toHaveClass('w-full', 'justify-center');
    expect(container.querySelectorAll('div.min-w-0').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('button', { name: /compartir resultado/i })).toBeInTheDocument();
  });

  it('copia mensaje de compartir mejorado y muestra confirmación inline', async () => {
    render(<ResultsPage />);

    fireEvent.click(screen.getByRole('button', { name: /compartir resultado/i }));

    await waitFor(() => {
      expect(mocks.writeTextMock).toHaveBeenCalledWith('🎯 1100 pts 8/10 (80%)');
    });

    expect(screen.getByText('¡Resultado listo para compartir!')).toBeInTheDocument();
  });
});
