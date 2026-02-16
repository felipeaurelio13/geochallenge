import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../pages/LoginPage';

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
        'auth.login': 'Iniciar sesión',
        'auth.email': 'Email',
        'auth.password': 'Contraseña',
        'auth.loginButton': 'Ingresar',
        'auth.noAccount': 'No tienes cuenta?',
        'auth.registerHere': 'Regístrate',
        'auth.showPassword': 'Mostrar contraseña',
        'auth.hidePassword': 'Ocultar contraseña',
        'auth.show': 'Mostrar',
        'auth.hide': 'Ocultar',
        'auth.completeFieldsHint': 'Completa correo y contraseña para continuar.',
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
      <MemoryRouter future={routerFutureConfig}>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret123' } });

    expect(screen.getByRole('button', { name: /Procesando.../i })).toBeDisabled();
  });

  it('muestra el tiempo de espera cuando backend responde rate limit en login', async () => {
    const loginMock = vi.fn().mockRejectedValue({
      response: {
        data: {
          retryAfterSeconds: 90,
        },
      },
    });

    mockUseAuth.mockReturnValue({ login: loginMock, isLoading: false });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText('Demasiados intentos. Intenta de nuevo en 2 min.')).toBeInTheDocument();
    });
  });

  it('deshabilita enviar hasta completar campos y muestra ayuda contextual', () => {
    mockUseAuth.mockReturnValue({ login: vi.fn(), isLoading: false });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <LoginPage />
      </MemoryRouter>
    );

    const submitButton = screen.getByRole('button', { name: /Ingresar/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Completa correo y contraseña para continuar.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret123' } });

    expect(submitButton).toBeEnabled();
    expect(screen.queryByText('Completa correo y contraseña para continuar.')).not.toBeInTheDocument();
  });


  it('limpia el mensaje de error cuando el usuario corrige un campo', async () => {
    const loginMock = vi.fn().mockRejectedValue(new Error('Credenciales inválidas'));
    mockUseAuth.mockReturnValue({ login: loginMock, isLoading: false });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret1234' } });
    expect(screen.queryByText('Credenciales inválidas')).not.toBeInTheDocument();
  });

  it('permite mostrar y ocultar contraseña para reducir errores en mobile', () => {
    mockUseAuth.mockReturnValue({ login: vi.fn(), isLoading: false });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <LoginPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText('Contraseña') as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: /mostrar contraseña/i });

    expect(passwordInput.type).toBe('password');
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('text');
    expect(screen.getByRole('button', { name: /ocultar contraseña/i })).toBeInTheDocument();
  });
});
