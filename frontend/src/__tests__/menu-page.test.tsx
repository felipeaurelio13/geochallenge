import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuPage } from '../pages/MenuPage';
import { Screen } from '../components/Screen';

const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

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
        'menu.welcomeExplore': `¡Hola ${options?.name}! ¿Qué vamos a explorar hoy?`,
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
        'menu.selectedCategory': 'Categoría activa',
        'menu.mobileCategoriesHint': 'Desliza para ver más categorías',
        'menu.quickActions': 'Acciones rápidas',
        'menu.gameModes': 'Modos de juego',
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
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogout.mockReset();
    window.localStorage.clear();
  });

  it('envía la categoría seleccionada al iniciar un duelo', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    const banderasButton = screen.getByRole('button', { name: /banderas/i });
    fireEvent.click(banderasButton);

    const duelModeButton = screen.getByRole('button', { name: /duelo[\s\S]*compite/i });
    fireEvent.click(duelModeButton);

    expect(mockNavigate).toHaveBeenCalledWith('/duel?category=FLAG');
  });

  it('abre desafíos con categoría preseleccionada para parametrizar rápido', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /capitales/i }));
    fireEvent.click(screen.getByRole('button', { name: /desafíos[\s\S]*envía/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/challenges?category=CAPITAL&openCreate=1');
  });

  it('elimina textos redundantes de categoría activa y mantiene footer con versión visible', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /capitales/i }));
    fireEvent.click(screen.getByRole('button', { name: /un jugador[\s\S]*juega solo/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/game/single?category=CAPITAL');
    expect(screen.queryByText('Desliza para ver más categorías')).not.toBeInTheDocument();
    expect(screen.queryByText('Categoría activa:')).not.toBeInTheDocument();
    expect(screen.queryByText('Acciones rápidas')).not.toBeInTheDocument();
    expect(screen.getByText(/v\d+\.\d+\.\d+/i)).toHaveClass('app-footer__version');
  });

  it('mantiene menú enfocado y oculta estadísticas para reducir ruido visual', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <MenuPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Tus estadísticas')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /rankings/i })).not.toBeInTheDocument();
  });

  it('aplica layout compacto mobile-first para reducir scroll sin recortar CTAs', () => {
    const { container } = render(
      <MemoryRouter future={routerFutureConfig}>
        <MenuPage />
      </MemoryRouter>,
    );

    expect(container.firstChild).toHaveClass('app-shell');

    const main = container.querySelector('main');
    expect(main?.className).toContain('py-2.5');

    const categoryButton = screen.getByRole('button', { name: /🎲\s*mixto/i });
    expect(categoryButton.className).toContain('min-h-10');

    const singleModeButton = screen.getByRole('button', { name: /mixto\s+un jugador/i });
    expect(singleModeButton.className).toContain('py-2.5');
    expect(screen.getByRole('heading', { name: 'Modos de juego' })).toBeInTheDocument();
  });

  it('permite cambiar categoría en el carrusel sin textos redundantes', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <MenuPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /mapas/i }));

    expect(screen.getByRole('button', { name: /🗺️\s*mapas/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('mantiene alineación consistente en selectores de categoría en reposo y seleccionado', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <MenuPage />
      </MemoryRouter>,
    );

    const mixedButton = screen.getByRole('button', { name: /🎲\s*mixto/i });
    const flagsButton = screen.getByRole('button', { name: /🏳️\s*banderas/i });

    expect(mixedButton.className).toContain('menu-category-selector');
    expect(flagsButton.className).toContain('menu-category-selector');
    expect(mixedButton.querySelector('.menu-category-selector__content')).toBeInTheDocument();
    expect(flagsButton.querySelector('.menu-category-selector__content')).toBeInTheDocument();
    expect(mixedButton.querySelector('.menu-category-selector__label')).toBeInTheDocument();
    expect(flagsButton.querySelector('.menu-category-selector__label')).toBeInTheDocument();

    fireEvent.click(flagsButton);
    expect(flagsButton).toHaveAttribute('aria-pressed', 'true');
    expect(flagsButton.className).toContain('menu-category-selector');
    expect(flagsButton.querySelector('.menu-category-selector__content')).toBeInTheDocument();
    expect(flagsButton.querySelector('.menu-category-selector__label')).toBeInTheDocument();
  });

  it('permite cambiar categoría y navegar a partida individual con categoría seleccionada', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <MenuPage />
      </MemoryRouter>,
    );

    const capitalesButton = screen.getByRole('button', { name: /capitales/i });
    fireEvent.click(capitalesButton);

    expect(capitalesButton).toHaveAttribute('aria-pressed', 'true');

    const singleModeButton = screen.getByRole('button', { name: /un jugador[\s\S]*juega solo/i });
    fireEvent.click(singleModeButton);

    expect(mockNavigate).toHaveBeenCalledWith('/game/single?category=CAPITAL');
  });
});
