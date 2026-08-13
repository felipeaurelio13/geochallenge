import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuPage } from '../pages/MenuPage';
import { Screen } from '../components/Screen';

const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(),
  getDailyStatus: vi.fn().mockResolvedValue({
    today: '2026-08-12',
    completed: false,
    dailyStreak: 0,
  }),
}));

const mockNavigate = mocks.navigate;
const mockLogout = mocks.logout;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
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
    logout: mocks.logout,
  }),
}));

vi.mock('../services/api', () => ({
  api: {
    getGameAvailability: vi.fn(() => new Promise(() => {})),
    getMasterySummary: vi.fn().mockResolvedValue({
      worldProgressPercent: 0,
      totalCountries: 180,
      stampedCountries: 0,
      masteredCountries: 0,
      skills: [],
    }),
    getDailyStatus: mocks.getDailyStatus,
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
        'menu.flashDesc': '60s',
        'menu.singlePlayer': 'Un Jugador',
        'menu.singlePlayerDesc': 'Juega solo',
        'menu.duel': 'Duelo',
        'menu.duelDesc': 'Compite',
        'menu.challenge': 'Desafíos',
        'menu.challengeDesc': 'Envía desafíos',
        'menu.streak': 'Racha',
        'menu.streakDesc': 'Sigue hasta fallar',
        'menu.survival': 'Supervivencia',
        'menu.survivalDesc': 'Sobrevive',
        'menu.geoChallenges': 'GeoRetos',
        'menu.geoChallengesBadge': 'Nuevo',
        'menu.geoChallengesDesc': '5 retos',
        'menu.geoChallengesDuel': 'GeoRetos en duelo',
        'menu.geoChallengesDuelDesc': '10 preguntas · 1 contra 1',
        'categories.flags': 'Banderas',
        'categories.capitals': 'Capitales',
        'categories.maps': 'Mapas',
        'categories.silhouettes': 'Siluetas',
        'categories.monuments': 'Monumentos',
        'categories.cinemaGeo': 'Cine & Geo',
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
        'menu.journey.title': 'Tu viaje por el mundo',
        'menu.journey.stamped': 'países explorados',
        'menu.journey.mastered': 'dominados',
        'menu.journey.globalDominance': 'Dominio global',
        'menu.journey.continue': 'Seguir explorando',
        'menu.journey.passport': 'Pasaporte',
        'menu.journey.startTitle': 'Empieza tu viaje por el mundo',
        'menu.journey.startFirst': 'Empezar a explorar',
        'menu.journey.zeroStamps': '0 de {{total}} países explorados',
        'menu.journey.startDesc': 'Cada partida te ayuda a descubrir y dominar nuevos países.',
        'menu.daily.title': 'Reto del día',
        'menu.daily.available': 'Disponible',
        'menu.daily.completed': 'Completado',
        'menu.daily.desc': '10 preguntas · mismas para todos · un intento',
        'menu.daily.play': 'Jugar reto de hoy',
        'menu.daily.viewResult': 'Ver resultado',
        'menu.daily.todayScore': 'Hoy: {{correct}} / {{total}}',
        'menu.daily.streak': 'Racha: {{days}} días',
        'menu.choose.title': '¿Qué quieres hacer?',
        'menu.choose.practice': 'Practicar',
        'menu.choose.practiceDesc': 'A tu manera',
        'menu.choose.compete': 'Competir',
        'menu.choose.competeDesc': 'Contra otros',
        'menu.practice.title': 'Practicar',
        'menu.practice.subtitle': 'Elige qué quieres entrenar.',
        'menu.practice.categories': 'Categorías',
        'menu.practice.formats': 'Formato',
        'menu.practice.classic': 'Clásico',
        'menu.practice.classicDesc': '10 preguntas a tu ritmo',
        'menu.practice.flash': 'Flash',
        'menu.practice.flashDesc': 'Rápido · 2 opciones',
        'menu.practice.streak': 'Racha',
        'menu.practice.streakDesc': 'Sigue mientras aciertes',
        'menu.practice.flashDisabledMap': 'El modo Flash no admite mapas — elige otra categoría',
        'menu.compete.title': 'Competir',
        'menu.compete.subtitle': 'Pon a prueba lo que sabes contra otros.',
        'menu.compete.category': 'Categoría',
        'menu.compete.duel': 'Duelo',
        'menu.compete.duelDesc': 'En vivo · 1 vs 1',
        'menu.compete.challenge': 'Desafío',
        'menu.compete.challengeDesc': 'Invita a otros · juega cuando quieras',
        'menu.compete.survival': 'Supervivencia',
        'menu.compete.survivalDesc': 'Último jugador en pie',
        'menu.special.flagMaster': 'Maestro de Banderas',
        'menu.special.flagMasterDesc': '10 rondas · sin color, recortes y trampas',
        'menu.special.geoChallenges': 'GeoRetos',
        'menu.special.geoChallengesDesc': '5 retos · extremos, comparaciones, fronteras',
        'menu.special.geoChallengesDuel': 'GeoRetos Duel',
        'menu.special.geoChallengesDuelDesc': '10 preguntas · 1 contra 1',
        'menu.more.title': 'Más',
        'menu.more.rankings': 'Rankings',
        'menu.more.rankingsDesc': 'Mira el top global y tu posición',
        'menu.more.stats': 'Mis estadísticas',
        'menu.more.statsDesc': 'Estadísticas, duelos y rivales',
        'common.close': 'Cerrar',
        'filters.unavailableCombination': 'Esta combinación no tiene suficientes preguntas ({{available}} disponibles, mínimo {{required}}).',
        'filters.insular': 'Islas',
        'filters.landlocked': 'Sin salida al mar',
        'filters.continents.Africa': 'África',
        'filters.continents.Europe': 'Europa',
        'filters.continents.Asia': 'Asia',
        'filters.continents.North_America': 'América del Norte',
        'filters.continents.South_America': 'América del Sur',
        'filters.continents.Oceania': 'Oceanía',
        'filters.difficulties.EASY': 'Fácil',
        'filters.difficulties.MEDIUM': 'Medio',
        'filters.difficulties.HARD': 'Difícil',
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

const ALL_GAME_MODES = ['flash', 'single', 'duel', 'challenge', 'streak', 'survival'];

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

describe('MenuPage — lobby cerrado', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogout.mockReset();
    mocks.getDailyStatus.mockResolvedValue({
      today: '2026-08-12',
      completed: false,
      dailyStreak: 0,
    });
    installInMemoryLocalStorage();
    window.localStorage.clear();
    markAllHowToSeen();
  });

  it('NO muestra CategorySelector cuando el lobby está cerrado', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('group', { name: /categorías de preguntas/i })).not.toBeInTheDocument();
  });

  it('NO muestra las 6 cards de modos antiguas', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /un jugador[\s\S]*juega solo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /duelo[\s\S]*compite/i })).not.toBeInTheDocument();
  });

  it('muestra Journey, Daily, Practice y Compete', async () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Empieza tu viaje por el mundo')).toBeDefined();
    });
    expect(screen.getByText('Practicar')).toBeDefined();
    expect(screen.getByText('Competir')).toBeDefined();
  });

  it('Rankings accesible', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <MenuPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /rankings/i })).toHaveAttribute('href', '/rankings');
  });

  it('Stats accesible', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <MenuPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /mis estadísticas/i })).toHaveAttribute('href', '/profile');
  });
});

describe('MenuPage — journey card', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mocks.getDailyStatus.mockResolvedValue({
      today: '2026-08-12',
      completed: false,
      dailyStreak: 0,
    });
    installInMemoryLocalStorage();
    window.localStorage.clear();
  });

  it('usuario nuevo → Journey 0 países', async () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('0 de 180 países explorados')).toBeDefined();
    });
    expect(screen.getByText('Empezar a explorar')).toBeDefined();
  });

  it('usuario con progreso → stamps correctos', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.getMasterySummary).mockResolvedValue({
      worldProgressPercent: 3.7,
      totalCountries: 180,
      stampedCountries: 24,
      masteredCountries: 2,
      skills: [],
    });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Tu viaje por el mundo')).toBeDefined();
    });
    expect(screen.getByText(/24 países explorados/)).toBeDefined();
    expect(screen.getByText(/2 dominados/)).toBeDefined();
  });

  it('Continue Journey → gameType=practice', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.getMasterySummary).mockResolvedValue({
      worldProgressPercent: 1,
      totalCountries: 180,
      stampedCountries: 3,
      masteredCountries: 0,
      skills: [],
    });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Seguir explorando')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Seguir explorando'));
    expect(mockNavigate).toHaveBeenCalledWith('/game/single?gameType=practice');
  });

  it('Passport → /passport', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.getMasterySummary).mockResolvedValue({
      worldProgressPercent: 1,
      totalCountries: 180,
      stampedCountries: 3,
      masteredCountries: 0,
      skills: [],
    });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Pasaporte')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Pasaporte'));
    expect(mockNavigate).toHaveBeenCalledWith('/passport');
  });
});

describe('MenuPage — daily card', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mocks.getDailyStatus.mockResolvedValue({
      today: '2026-08-12',
      completed: false,
      dailyStreak: 0,
    });
    installInMemoryLocalStorage();
    window.localStorage.clear();
    markAllHowToSeen();
  });

  it('Daily pendiente → CTA Jugar', async () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Disponible')).toBeDefined();
    });
    expect(screen.getByText('Jugar reto de hoy')).toBeDefined();
  });

  it('Daily completado → score + streak', async () => {
    mocks.getDailyStatus.mockResolvedValue({
      today: '2026-08-12',
      completed: true,
      dailyStreak: 4,
      result: {
        score: 800,
        correctCount: 8,
        totalQuestions: 10,
        playedAt: '2026-08-12T10:00:00.000Z',
      },
    });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Completado')).toBeDefined();
    });
    expect(screen.getByText('Ver resultado')).toBeDefined();
  });

  it('fallo Daily status → lobby sigue usable', async () => {
    mocks.getDailyStatus.mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Practicar')).toBeDefined();
    });
    expect(screen.getByText('Competir')).toBeDefined();
  });
});

describe('MenuPage — panels', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mocks.getDailyStatus.mockResolvedValue({
      today: '2026-08-12',
      completed: false,
      dailyStreak: 0,
    });
    installInMemoryLocalStorage();
    window.localStorage.clear();
    markAllHowToSeen();
  });

  it('click Practicar → abre panel', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Practicar'));
    expect(screen.getByText('Elige qué quieres entrenar.')).toBeDefined();
  });

  it('panel Practice → CategorySelector', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Practicar'));
    expect(screen.getByRole('group', { name: /categorías de preguntas/i })).toBeDefined();
  });

  it('panel Practice → Clásico/Flash/Racha', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Practicar'));
    expect(screen.getByText('Clásico')).toBeDefined();
    expect(screen.getByText('Flash')).toBeDefined();
    expect(screen.getByText('Racha')).toBeDefined();
  });

  it('MAP → Flash disabled', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Practicar'));
    fireEvent.click(screen.getByRole('button', { name: /^mapas$/i }));

    expect(screen.getByText(/el modo flash no admite mapas/i)).toBeDefined();
  });

  it('Flag Master accesible desde Practice', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Practicar'));
    expect(screen.getByText('Maestro de Banderas')).toBeDefined();
  });

  it('GeoRetos accesible desde Practice', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Practicar'));
    expect(screen.getByText('GeoRetos')).toBeDefined();
  });

  it('click Competir → abre panel Competition', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Competir'));
    expect(screen.getByText('Pon a prueba lo que sabes contra otros.')).toBeDefined();
  });

  it('Competition → Duel/Challenge/Survival', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Competir'));
    expect(screen.getByText('Duelo')).toBeDefined();
    expect(screen.getByText('Desafío')).toBeDefined();
    expect(screen.getByText('Supervivencia')).toBeDefined();
  });

  it('GeoRetos Duel accesible desde Compete', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Competir'));
    expect(screen.getByText('GeoRetos Duel')).toBeDefined();
  });

  it('sólo un panel abierto a la vez', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Practicar'));
    expect(screen.getByText('Elige qué quieres entrenar.')).toBeDefined();

    fireEvent.click(screen.getByText('Competir'));
    expect(screen.queryByText('Elige qué quieres entrenar.')).not.toBeInTheDocument();
    expect(screen.getByText('Pon a prueba lo que sabes contra otros.')).toBeDefined();
  });
});

describe('MenuPage — HowTo first-run', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mocks.getDailyStatus.mockResolvedValue({
      today: '2026-08-12',
      completed: false,
      dailyStreak: 0,
    });
    installInMemoryLocalStorage();
    window.localStorage.clear();
  });

  it('abre modal en vez de navegar la primera vez que se toca un modo, y navega al confirmar', () => {
    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Practicar'));
    fireEvent.click(screen.getByText('Clásico'));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByText('Objetivo single')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '¡Jugar!' }));
    expect(mockNavigate).toHaveBeenCalled();
    expect(window.localStorage.getItem('howto_seen_single')).toBe('1');
  });

  it('no vuelve a auto-abrirse para el mismo modo una vez visto', () => {
    window.localStorage.setItem('howto_seen_single', '1');

    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Practicar'));
    fireEvent.click(screen.getByText('Clásico'));

    expect(mockNavigate).toHaveBeenCalled();
    expect(screen.queryByText('Objetivo single')).not.toBeInTheDocument();
  });

  it('abre modal manualmente con "?" sin navegar al cerrar', () => {
    window.localStorage.setItem('howto_seen_single', '1');

    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <MenuPage />
        </Screen>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Practicar'));

    const helpButton = screen.getByRole('button', { name: 'Cómo se juega Un Jugador' });
    fireEvent.click(helpButton);

    expect(screen.getByText('Objetivo single')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
