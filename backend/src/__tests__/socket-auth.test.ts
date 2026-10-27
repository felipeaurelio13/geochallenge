import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import {
  authenticateSocket,
  limitConcurrentSockets,
  registerActiveSocket,
  unregisterActiveSocket,
  resetActiveSockets,
  getSocketClientIp,
  SOCKET_RATE_LIMIT,
  activeSocketsByIp,
  activeSocketsByUser,
} from '../sockets/index.js';

function createMockSocket(options: {
  auth?: Record<string, unknown>;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  address?: string;
  id?: string;
}): Socket {
  return {
    id: options.id || 'sock-test-1',
    handshake: {
      auth: options.auth,
      query: options.query,
      headers: options.headers || {},
      address: options.address || '127.0.0.1',
    },
  } as unknown as Socket;
}

describe('Socket connection hardening & rate limiting', () => {
  const validPayload = {
    userId: 'user-123',
    username: 'geoplayer',
    email: 'player@example.com',
  };

  beforeEach(() => {
    resetActiveSockets();
  });

  describe('authenticateSocket middleware', () => {
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

    it('rechaza conexión cuando el usuario excede el límite de conexiones simultáneas', () => {
      const validToken = jwt.sign(validPayload, config.jwt.secret);
      for (let i = 0; i < SOCKET_RATE_LIMIT.MAX_CONCURRENT_PER_USER; i++) {
        registerActiveSocket('127.0.0.1', validPayload.userId, `sock-${i}`);
      }

      const socket = createMockSocket({
        auth: { token: validToken },
      });
      const next = vi.fn();

      authenticateSocket(socket, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Límite de conexiones simultáneas por usuario alcanzado');
      expect(socket.user).toBeUndefined();
    });
  });

  describe('limitConcurrentSockets middleware', () => {
    it('extrae IP de x-forwarded-for respetando proxies', () => {
      const socket = createMockSocket({
        headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
      });
      expect(getSocketClientIp(socket)).toBe('203.0.113.195');
    });

    it('bloquea handshake cuando una IP alcanza el cupo máximo de sockets activos simultáneos', () => {
      const ip = '198.51.100.3';
      for (let i = 0; i < SOCKET_RATE_LIMIT.MAX_CONCURRENT_PER_IP; i++) {
        registerActiveSocket(ip, `user-${i}`, `sock-ip-${i}`);
      }

      const socket = createMockSocket({ address: ip });
      const next = vi.fn();
      limitConcurrentSockets(socket, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Límite de conexiones simultáneas por IP alcanzado');
    });

    it('permite el handshake cuando la IP está por debajo del cupo', () => {
      const socket = createMockSocket({ address: '198.51.100.4' });
      const next = vi.fn();
      limitConcurrentSockets(socket, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('lifecycle de activeSockets', () => {
    it('registra y desregistra sockets activos liberando memoria', () => {
      registerActiveSocket('10.0.0.1', 'user-1', 'sock-a');
      registerActiveSocket('10.0.0.1', 'user-1', 'sock-b');

      expect(activeSocketsByIp.get('10.0.0.1')?.size).toBe(2);
      expect(activeSocketsByUser.get('user-1')?.size).toBe(2);

      unregisterActiveSocket('10.0.0.1', 'user-1', 'sock-a');
      expect(activeSocketsByIp.get('10.0.0.1')?.size).toBe(1);

      unregisterActiveSocket('10.0.0.1', 'user-1', 'sock-b');
      expect(activeSocketsByIp.has('10.0.0.1')).toBe(false);
      expect(activeSocketsByUser.has('user-1')).toBe(false);
    });
  });
});
