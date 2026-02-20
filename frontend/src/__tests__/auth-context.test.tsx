import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';

const loginMock = vi.fn();
const registerMock = vi.fn();
const connectMock = vi.fn();
const disconnectMock = vi.fn();

vi.mock('../services/api', () => ({
  api: {
    getMe: vi.fn().mockRejectedValue(new Error('No session')),
    login: (...args: unknown[]) => loginMock(...args),
    register: (...args: unknown[]) => registerMock(...args),
  },
}));

vi.mock('../services/socket', () => ({
  socketService: {
    connect: (...args: unknown[]) => connectMock(...args),
    disconnect: (...args: unknown[]) => disconnectMock(...args),
  },
}));

vi.mock('../utils/testAuthBypass', () => ({
  testAuthBypass: {
    isEnabled: false,
    isConfigured: false,
    secret: '',
  },
  buildTestBypassUser: vi.fn(),
}));

function Harness() {
  const { login, register } = useAuth();

  return (
    <div>
      <button onClick={() => login('  USER@Example.COM  ', 'secret123')}>do-login</button>
      <button onClick={() => register('  GeoUser  ', '  USER@Example.COM  ', 'secret123')}>do-register</button>
    </div>
  );
}

describe('AuthContext', () => {
  it('normaliza email/username antes de llamar al API para evitar fallas de login/registro', async () => {
    loginMock.mockResolvedValue({ token: 't', user: { id: '1' } });
    registerMock.mockResolvedValue({ token: 't', user: { id: '1' } });

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('do-login'));
    fireEvent.click(screen.getByText('do-register'));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret123' });
      expect(registerMock).toHaveBeenCalledWith({
        username: 'GeoUser',
        email: 'user@example.com',
        password: 'secret123',
      });
    });
  });
});
