import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HomePage } from '../pages/HomePage';
import { Screen } from '../components/Screen';

const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'home.badge': 'Trivia geográfica competitiva',
        'home.subtitle': 'Pon a prueba tus conocimientos de geografía.',
        'home.play': 'Jugar ahora',
        'home.login': 'Iniciar sesión',
        'home.register': 'Crear cuenta',
        'home.features.flags': 'Banderas',
        'home.features.flagsDesc': 'Identifica países por su bandera.',
        'home.features.maps': 'Mapas',
        'home.features.mapsDesc': 'Encuentra ubicaciones en el mapa.',
        'home.features.multiplayer': 'Multijugador',
        'home.features.multiplayerDesc': 'Compite en duelos en tiempo real.',
        'home.quickTrustLine': 'Sin anuncios invasivos · partidas rápidas · enfoque mobile-first',
        'common.skipToMainAction': 'Ir a las acciones principales',
        'nav.rankings': 'Rankings',
      };

      if (key === 'home.welcomeBack') {
        return `¡Bienvenido de vuelta, ${options?.name ?? ''}! Tu próxima partida está a un toque.`;
      }

      return translations[key] ?? key;
    },
  }),
}));

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra acciones de acceso cuando el usuario no está autenticado', () => {
    mockUseAuth.mockReturnValue({ user: null });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <HomePage />
        </Screen>
      </MemoryRouter>
    );

    expect(document.querySelector('div.app-shell')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a las acciones principales' })).toHaveAttribute(
      'href',
      '#home-main-actions'
    );
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/register');
    expect(screen.queryByRole('link', { name: 'Rankings' })).not.toBeInTheDocument();
    expect(screen.getByText(/v\d+\.\d+\.\d+/i)).toHaveClass('app-footer__version');
  });

  it('prioriza layout minimalista sin tarjetas de características redundantes', () => {
    mockUseAuth.mockReturnValue({ user: null });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.queryByText('Trivia geográfica competitiva')).not.toBeInTheDocument();
    expect(screen.queryByText('Banderas · Mapas · Multijugador')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin anuncios invasivos · partidas rápidas · enfoque mobile-first')).not.toBeInTheDocument();
    expect(screen.queryByText('Identifica países por su bandera.')).not.toBeInTheDocument();
    expect(screen.getByText('Pon a prueba tus conocimientos de geografía.')).toBeInTheDocument();
  });

  it('muestra acción principal de juego cuando hay un usuario autenticado', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', username: 'geo' } });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Jugar ahora' })).toHaveAttribute('href', '/menu');
    expect(screen.getByRole('link', { name: 'Rankings' })).toHaveAttribute('href', '/rankings');
    expect(screen.getByText('¡Bienvenido de vuelta, geo! Tu próxima partida está a un toque.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
    expect(screen.queryByText('Pon a prueba tus conocimientos de geografía.')).not.toBeInTheDocument();
  });
});
