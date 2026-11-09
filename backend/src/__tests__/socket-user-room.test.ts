import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Socket, Server as SocketIOServer } from 'socket.io';
import {
  getUserRoom,
  emitToUser,
  setupSocketHandlers,
  userSockets,
  matchmakingQueue,
} from '../sockets/index.js';

describe('Socket.IO user room pattern and emitToUser', () => {
  beforeEach(() => {
    userSockets.clear();
  });

  describe('getUserRoom', () => {
    it('genera la clave canónica de sala por usuario', () => {
      expect(getUserRoom('user-abc')).toBe('user:user-abc');
      expect(getUserRoom('12345')).toBe('user:12345');
    });
  });

  describe('setupSocketHandlers connection and room joining', () => {
    it('une el socket a la sala del usuario al conectar', () => {
      let connectionHandler: ((socket: Socket) => void) | undefined;
      const fakeIo = {
        use: vi.fn(),
        on: vi.fn((event: string, handler: any) => {
          if (event === 'connection') {
            connectionHandler = handler;
          }
        }),
      } as unknown as SocketIOServer;

      setupSocketHandlers(fakeIo);
      expect(connectionHandler).toBeDefined();

      const joinMock = vi.fn();
      const onMock = vi.fn();
      const useMock = vi.fn();

      const fakeSocket = {
        id: 'sock-1',
        user: { userId: 'u-42', username: 'explorer' },
        join: joinMock,
        use: useMock,
        on: onMock,
      } as unknown as Socket;

      connectionHandler!(fakeSocket);

      // Debe unirse a la sala user:u-42
      expect(joinMock).toHaveBeenCalledWith('user:u-42');
      // Debe registrarse en userSockets
      expect(userSockets.get('u-42')).toBe('sock-1');
    });

    it('limpia userSockets al desconectar si el socket coincide', () => {
      let connectionHandler: ((socket: Socket) => void) | undefined;
      const fakeIo = {
        use: vi.fn(),
        on: vi.fn((event: string, handler: any) => {
          if (event === 'connection') {
            connectionHandler = handler;
          }
        }),
      } as unknown as SocketIOServer;

      setupSocketHandlers(fakeIo);

      const listeners: Record<string, (reason?: string) => void> = {};
      const fakeSocket = {
        id: 'sock-1',
        user: { userId: 'u-42', username: 'explorer' },
        join: vi.fn(),
        use: vi.fn(),
        on: vi.fn((event: string, handler: any) => {
          listeners[event] = handler;
        }),
      } as unknown as Socket;

      connectionHandler!(fakeSocket);
      expect(userSockets.get('u-42')).toBe('sock-1');

      // Disconnect
      listeners['disconnect']?.('transport close');
      expect(userSockets.get('u-42')).toBeUndefined();
    });
  });

  describe('emitToUser routing', () => {
    it('emite a la sala del usuario cuando hay sockets activos en el adapter', () => {
      const emitMock = vi.fn();
      const toMock = vi.fn().mockReturnValue({ emit: emitMock });

      const rooms = new Map<string, Set<string>>();
      rooms.set('user:player-1', new Set(['sock-a', 'sock-b'])); // Simula multi-pestaña

      const mockIo = {
        sockets: {
          adapter: {
            rooms,
          },
        },
        to: toMock,
      } as unknown as SocketIOServer;

      const sent = emitToUser(mockIo, 'player-1', 'notification:achievement', { id: 'ach-1' });

      expect(sent).toBe(true);
      expect(toMock).toHaveBeenCalledWith('user:player-1');
      expect(emitMock).toHaveBeenCalledWith('notification:achievement', { id: 'ach-1' });
    });

    it('devuelve false y no emite cuando el usuario no tiene sockets conectados', () => {
      const emitMock = vi.fn();
      const toMock = vi.fn().mockReturnValue({ emit: emitMock });

      const rooms = new Map<string, Set<string>>();

      const mockIo = {
        sockets: {
          adapter: {
            rooms,
          },
        },
        to: toMock,
      } as unknown as SocketIOServer;

      const sent = emitToUser(mockIo, 'player-offline', 'notification', { test: true });

      expect(sent).toBe(false);
      expect(toMock).not.toHaveBeenCalled();
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('soporta fallback a userSockets cuando adapter.rooms no está definido', () => {
      const emitMock = vi.fn();
      const toMock = vi.fn().mockReturnValue({ emit: emitMock });

      userSockets.set('player-legacy', 'sock-legacy');

      const mockIo = {
        to: toMock,
      } as unknown as SocketIOServer;

      const sent = emitToUser(mockIo, 'player-legacy', 'duel:invite', { duelId: 'd-1' });

      expect(sent).toBe(true);
      expect(toMock).toHaveBeenCalledWith('user:player-legacy');
      expect(emitMock).toHaveBeenCalledWith('duel:invite', { duelId: 'd-1' });
    });
  });
});
