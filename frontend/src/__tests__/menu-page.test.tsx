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

vi.mock('../services/api', () => ({
  api: {
    getGameAvailability: vi.fn(() => new Promise(() => {})),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, _options?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'menu.selectCategory': 'Selecciona una categoría',
        'menu.gameModes': 'Modos de juego',
        'menu.categorySelectorLabel': 'Categorías de preguntas',
        'menu.flash': 'Flash',
        'menu.flashDesc': '60s · combo x10',
        'menu.singlePlayer': 'Un Jugador',
        'menu.singlePlayerDesc': 'Juega solo y mejora tu puntuación',
        'menu.duel': 'Duelo',
        'menu.duelDesc': 'Compite en tiempo real contra otro jugador',
        'menu.challenge': 'Desafíos',
        'menu.challengeDesc': 'Envía desafíos a tus amigos',
        'menu.streak': 'Racha',
        'menu.streakDesc': 'Sigue hasta fallar y rompe tu récord',
        'categories.flags': 'Banderas',
        'categories.capitals': 'Capitales',
        'categories.maps': 'Mapas',
        'categories.silhouettes': 'Siluetas',
        'categories.mixed': 'Mixto',
        'auth.logout': 'Cerrar sesión',
        'filters.filterBy': 'Filtrar',
        'filters.openFilters': 'Abrir filtros de preguntas',
        'filters.openActiveFilters': 'Abrir filtros de preguntas. Filtros activos: {{summary}}',
        'filters.clearActive': 'Limpiar filtros activos',
        'menu.howToPlayAria': 'Cómo se juega {{mode}}',
        'menu.letsPlay': '¡Jugar!',
        'howto.flash.objective': 'Objetivo flash',
        'howto.flash.rule': 'Regla flash',
        'howto.flash.tip': 'Tip flash',
        'howto.single.objective': 'Objetivo single',
        'howto.single.rule': 'Regla single',
        'howto.single.tip': 'Tip single',
        'howto.duel.objective': 'Objetivo duel',
        'howto.duel.rule': 'Regla duel',
        'howto.duel.tip': 'Tip duel',
        'howto.challenge.objective': 'Objetivo challenge',
        'howto.challenge.rule': 'Regla challenge',
        'howto.challenge.tip': 'Tip challenge',
        'howto.streak.objective': 'Objetivo streak',
        'howto.streak.rule': 'Regla streak',
        'howto.streak.tip': 'Tip streak',
        'howto.survival.objective': 'Objetivo survival',
        'howto.survival.rule': 'Regla survival',
        'howto.survival.tip': 'Tip survival',
      };
      const template = translations[key] ?? key;
      if (!_options) return template;
      return Object.entries(_options).reduce(
        (acc, [optKey, optValue]) => acc.replace(`{{${optKey}}}`, String(optValue ?? '')),
        template
      );
    },
  }),
}));

// Todos los modos de juego que existen hoy en MenuPage — usados para simular
// un usuario "recurrente" que ya vio el modal de "cómo se juega" de cada uno,
// así los tests de navegación siguen probando el click directo sin que el
// modal de primera vez intercepte el flujo.
const ALL_GAME_MODES = ['flash', 'single', 'duel', 'challenge', 'streak', 'survival'];

// `src/__tests__/setup.ts` (infra compartida, fuera de este scope) stubea
// `window.localStorage` con getItem/setItem no-op que siempre devuelven
// `null`. Eso es correcto para la mayoría de los tests, pero el modal de
// "cómo se juega" SÍ necesita persistencia real entre el set y el get dentro
// del mismo test. Instalamos un mock en memoria sólo para este archivo.
function installInMemoryLocalStorage() {
  let store: Record<string, string> = {};
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    },
  });
}

function markAllHowToSeen() {
  ALL_GAME_MODES.forEach((mode) => window.localStorage.setItem(`howto_seen_${mode}`, '1'));
}

describe('MenuPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogout.mockReset();
    installInMemoryLocalStorage();
    window.localStorage.clear();
    markAllHowToSeen();
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

  it('navega a racha reutilizando GamePage con mode=streak', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /mapas/i }));
    fireEvent.click(screen.getByRole('button', { name: /racha[\s\S]*sigue hasta fallar/i }));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/game/single?category=MAP&mode=streak');
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

  it('muestra accesos rápidos a rankings y perfil en la sección de acciones rápidas', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <MenuPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Tus estadísticas')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rankings/i })).toBeInTheDocument();
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

    const categoryButton = screen.getByRole('button', { name: /^mixto$/i });
    expect(categoryButton.className).toContain('min-h-[4.5rem]');

    const singleModeButton = screen.getByRole('button', { name: /un jugador[\s\S]*juega solo/i });
    expect(singleModeButton.className).toContain('py-2.5');

    const modesSection = screen.getByRole('region', { name: /modos de juego/i });
    const modeButtons = Array.from(modesSection.querySelectorAll('button'));
    expect(modeButtons.length).toBeGreaterThanOrEqual(5);

    expect(screen.queryByText(/¡hola.*explorar hoy/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Modos de juego' })).not.toBeInTheDocument();
  });

  it('permite cambiar categoría en el carrusel sin textos redundantes', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <MenuPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /mapas/i }));

    expect(screen.getByRole('button', { name: /^mapas$/i })).toHaveAttribute(
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

    const mixedButton = screen.getByRole('button', { name: /^mixto$/i });
    const flagsButton = screen.getByRole('button', { name: /^banderas$/i });

    expect(mixedButton.className).toContain('menu-category-selector');
    expect(flagsButton.className).toContain('menu-category-selector');
    expect(mixedButton.querySelector('.menu-category-selector__icon')).toBeInTheDocument();
    expect(flagsButton.querySelector('.menu-category-selector__icon')).toBeInTheDocument();
    expect(mixedButton.querySelector('.menu-category-selector__label')).toBeInTheDocument();
    expect(flagsButton.querySelector('.menu-category-selector__label')).toBeInTheDocument();

    fireEvent.click(flagsButton);
    expect(flagsButton).toHaveAttribute('aria-pressed', 'true');
    expect(flagsButton.className).toContain('menu-category-selector');
    expect(flagsButton.querySelector('.menu-category-selector__icon')).toBeInTheDocument();
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

  it('expone nombres accesibles claros para categorías y filtros', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <MenuPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('group', { name: /categorías de preguntas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^banderas$/i })).toBeInTheDocument();

    const filterButton = screen.getByRole('button', { name: /abrir filtros de preguntas/i });
    expect(filterButton).toHaveAttribute('aria-haspopup', 'dialog');
    expect(filterButton).toHaveAttribute('aria-expanded', 'false');
  });

  describe('modal de "cómo se juega" la primera vez', () => {
    beforeEach(() => {
      // Este describe prueba explícitamente el estado "primera vez" —
      // localStorage vacío, sin los flags que el resto del archivo setea.
      window.localStorage.clear();
    });

    it('abre el modal en vez de navegar la primera vez que se toca un modo, y navega recién al confirmar', () => {
      render(
        <MemoryRouter future={routerFutureConfig}>
          <MenuPage />
        </MemoryRouter>,
      );

      const singleModeButton = screen.getByRole('button', { name: /un jugador[\s\S]*juega solo/i });
      fireEvent.click(singleModeButton);

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.getByText('Objetivo single')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '¡Jugar!' }));

      expect(mockNavigate).toHaveBeenCalledWith('/game/single?category=MIXED');
      expect(window.localStorage.getItem('howto_seen_single')).toBe('1');
    });

    it('no vuelve a auto-abrirse para el mismo modo una vez visto', () => {
      window.localStorage.setItem('howto_seen_duel', '1');

      render(
        <MemoryRouter future={routerFutureConfig}>
          <MenuPage />
        </MemoryRouter>,
      );

      const duelModeButton = screen.getByRole('button', { name: /duelo[\s\S]*compite/i });
      fireEvent.click(duelModeButton);

      expect(mockNavigate).toHaveBeenCalledWith('/duel?category=MIXED');
      expect(screen.queryByText('Objetivo duel')).not.toBeInTheDocument();
    });

    it('abre el modal manualmente con el botón "?" sin navegar al cerrar sin confirmar', () => {
      render(
        <MemoryRouter future={routerFutureConfig}>
          <MenuPage />
        </MemoryRouter>,
      );

      const helpButton = screen.getByRole('button', { name: 'Cómo se juega Un Jugador' });
      fireEvent.click(helpButton);

      expect(screen.getByText('Objetivo single')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '✕' }));

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
