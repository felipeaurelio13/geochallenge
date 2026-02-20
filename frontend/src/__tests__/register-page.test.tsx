import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RegisterPage } from '../pages/RegisterPage';
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
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.register': 'Crear cuenta',
        'auth.username': 'Usuario',
        'auth.email': 'Email',
        'auth.password': 'Contraseña',
        'auth.confirmPassword': 'Confirmar contraseña',
        'auth.passwordHint': 'Mínimo 6 caracteres',
        'auth.registerButton': 'Crear',
        'auth.hasAccount': '¿Ya tienes cuenta?',
        'auth.loginHere': 'Inicia sesión',
        'auth.passwordMismatch': 'Las contraseñas no coinciden',
        'auth.passwordTooShort': 'La contraseña es muy corta',
        'auth.registerError': 'No se pudo crear la cuenta',
        'common.back': 'Volver',
      };
      return translations[key] ?? key;
    },
  }),
}));

describe('RegisterPage', () => {
  it('muestra footer con versión y mantiene jerarquía visual dark-mode first', () => {
    mockUseAuth.mockReturnValue({ register: vi.fn(), isLoading: false });

    const { container } = render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <RegisterPage />
        </Screen>
      </MemoryRouter>
    );

    expect(container.querySelector('div.app-shell')).toBeInTheDocument();
    expect(screen.getByText(/v\d+\.\d+\.\d+/i)).toHaveClass('app-footer__version');
  });

  it('valida mismatch de contraseñas antes de enviar', async () => {
    const registerMock = vi.fn();
    mockUseAuth.mockReturnValue({ register: registerMock, isLoading: false });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <Screen>
          <RegisterPage />
        </Screen>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'geo' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'geo@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'secret456' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => {
      expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
    });

    expect(registerMock).not.toHaveBeenCalled();
  });
});
