import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HomePage } from '../pages/HomePage';

const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
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
      };

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
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Trivia geográfica competitiva')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/register');
    expect(screen.getByText('v1.1.19')).toBeInTheDocument();
  });

  it('muestra acción principal de juego cuando hay un usuario autenticado', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', username: 'geo' } });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Jugar ahora' })).toHaveAttribute('href', '/menu');
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
  });
});
