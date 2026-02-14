import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../pages/LoginPage';

const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.login': 'Iniciar sesión',
        'auth.email': 'Email',
        'auth.password': 'Contraseña',
        'auth.loginButton': 'Ingresar',
        'auth.noAccount': 'No tienes cuenta?',
        'auth.registerHere': 'Regístrate',
        'common.back': 'Volver',
      };
      return translations[key] ?? key;
    },
  }),
}));

describe('LoginPage', () => {
  it('muestra feedback de carga en el botón de ingreso', () => {
    mockUseAuth.mockReturnValue({ login: vi.fn(), isLoading: true });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Procesando.../i })).toBeDisabled();
  });
});
