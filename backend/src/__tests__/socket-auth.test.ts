import { describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { authenticateSocket } from '../sockets/index.js';

function createMockSocket(handshake: { auth?: Record<string, unknown>; query?: Record<string, unknown> }): Socket {
  return {
    handshake,
  } as unknown as Socket;
}

describe('authenticateSocket middleware', () => {
  const validPayload = {
    userId: 'user-123',
    username: 'geoplayer',
    email: 'player@example.com',
  };

  it('rechaza conexión cuando no hay token en handshake.auth', () => {
    const socket = createMockSocket({ auth: {} });
    const next = vi.fn();

    authenticateSocket(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Token de autenticación requerido');
    expect(socket.user).toBeUndefined();
  });

  it('rechaza conexión cuando el token sólo viene en query parameters (fallback deprecado eliminado)', () => {
    const validToken = jwt.sign(validPayload, config.jwt.secret);
    const socket = createMockSocket({
      auth: {},
      query: { token: validToken },
    });
    const next = vi.fn();

    authenticateSocket(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Token de autenticación requerido');
    expect(socket.user).toBeUndefined();
  });

  it('rechaza conexión cuando el token de auth es inválido', () => {
    const socket = createMockSocket({
      auth: { token: 'invalid.jwt.token' },
    });
    const next = vi.fn();

    authenticateSocket(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Token inválido');
    expect(socket.user).toBeUndefined();
  });

  it('autentica exitosamente y asigna socket.user cuando el token viene en handshake.auth', () => {
    const validToken = jwt.sign(validPayload, config.jwt.secret);
    const socket = createMockSocket({
      auth: { token: validToken },
    });
    const next = vi.fn();

    authenticateSocket(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.user).toBeDefined();
    expect(socket.user?.userId).toBe('user-123');
    expect(socket.user?.username).toBe('geoplayer');
  });

  describe('Socket.IO engine memory leak prevention', () => {
    it('discards raw HTTP request reference on engine connection', () => {
      const rawSocket = {
        request: {
          headers: { 'user-agent': 'GeoChallengeApp/1.0' },
          socket: { remoteAddress: '127.0.0.1' },
        } as unknown,
      };

      const handleEngineConnection = (sock: { request: unknown }) => {
        sock.request = null;
      };

      handleEngineConnection(rawSocket);
      expect(rawSocket.request).toBeNull();
    });
  });
});
