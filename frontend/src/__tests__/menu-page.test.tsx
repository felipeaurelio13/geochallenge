import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { MenuPage } from '../pages/MenuPage';

const mockNavigate = vi.fn();
const mockLogout = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      username: 'geoUser',
      highScore: 1200,
      gamesPlayed: 8,
      wins: 5,
      losses: 3,
    },
    logout: mockLogout,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'menu.welcome': `Hola, ${options?.name}!`,
        'menu.chooseMode': 'Elige un modo de juego',
        'menu.selectCategory': 'Selecciona una categoría',
        'menu.rankings': 'Rankings',
        'menu.singlePlayer': 'Un Jugador',
        'menu.singlePlayerDesc': 'Juega solo y mejora tu puntuación',
        'menu.duel': 'Duelo',
        'menu.duelDesc': 'Compite en tiempo real contra otro jugador',
        'menu.challenge': 'Desafíos',
        'menu.challengeDesc': 'Envía desafíos a tus amigos',
        'menu.yourStats': 'Tus estadísticas',
        'categories.flags': 'Banderas',
        'categories.capitals': 'Capitales',
        'categories.maps': 'Mapas',
        'categories.silhouettes': 'Siluetas',
        'categories.mixed': 'Mixto',
        'stats.highScore': 'Puntuación máxima',
        'stats.gamesPlayed': 'Partidas jugadas',
        'stats.wins': 'Victorias',
        'stats.losses': 'Derrotas',
        'auth.logout': 'Cerrar sesión',
      };
      return translations[key] ?? key;
    },
  }),
}));

describe('MenuPage', () => {
  it('envía la categoría seleccionada al iniciar un duelo', () => {
    render(
      <MemoryRouter>
        <MenuPage />
      </MemoryRouter>
    );

    const banderasButton = screen.getByRole('button', { name: /banderas/i });
    fireEvent.click(banderasButton);

    const duelModeButton = screen.getByRole('button', { name: /duelo/i });
    fireEvent.click(duelModeButton);

    expect(mockNavigate).toHaveBeenCalledWith('/duel?category=FLAG');
  });

  it('permite cambiar categoría y navegar a partida individual con categoría seleccionada', () => {
    render(
      <MemoryRouter>
        <MenuPage />
      </MemoryRouter>
    );

    const capitalesButton = screen.getByRole('button', { name: /capitales/i });
    fireEvent.click(capitalesButton);

    expect(capitalesButton).toHaveAttribute('aria-pressed', 'true');

    const singleModeButton = screen.getByRole('button', { name: /un jugador/i });
    fireEvent.click(singleModeButton);

    expect(mockNavigate).toHaveBeenCalledWith('/game/single?category=CAPITAL');
  });
});
