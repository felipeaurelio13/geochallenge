import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Socket, Server as SocketIOServer } from 'socket.io';
import { setupSocketHandlers, userSockets, emitToUser } from '../sockets/index.js';

describe('Socket.IO Connection State Recovery handling', () => {
  beforeEach(() => {
    userSockets.clear();
  });

  function createMockSocket(recovered: boolean, userId: string = 'user-456', username: string = 'traveler'): any {
    const handlers: Record<string, ((...args: any[]) => void)[]> = {};
    return {
      id: `socket-${userId}-${recovered ? 'rec' : 'new'}`,
      recovered,
      user: {
        userId,
        username,
        email: `${username}@example.com`,
      },
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        handlers[event] = handlers[event] || [];
        handlers[event].push(handler);
      }),
      emit: vi.fn(),
      use: vi.fn(),
      join: vi.fn(),
      _trigger: (event: string, ...args: any[]) => {
        handlers[event]?.forEach((h) => h(...args));
      },
    } as unknown as Socket;
  }

  function createMockIo(): { io: SocketIOServer; triggerConnection: (socket: any) => void } {
    let connectionHandler: ((socket: Socket) => void) | null = null;
    const mockIo = {
      use: vi.fn(),
      on: vi.fn((event: string, handler: (socket: Socket) => void) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({
        emit: vi.fn(),
      })),
    } as unknown as SocketIOServer;

    return {
      io: mockIo,
      triggerConnection: (socket: any) => {
        if (connectionHandler) connectionHandler(socket);
      },
    };
  }

  it('handles initial socket connection when recovered is false', () => {
    const { io, triggerConnection } = createMockIo();
    setupSocketHandlers(io);

    const socket = createMockSocket(false, 'user-normal');
    triggerConnection(socket);

    expect(userSockets.get('user-normal')).toBe(socket.id);
  });

  it('handles recovered socket session when recovered is true', () => {
    const { io, triggerConnection } = createMockIo();
    setupSocketHandlers(io);

    const socket = createMockSocket(true, 'user-recovered');
    triggerConnection(socket);

    expect(userSockets.get('user-recovered')).toBe(socket.id);

    // Can emit to user normally
    const emitted = emitToUser(io, 'user-recovered', 'test:event', { ok: true });
    expect(emitted).toBe(true);
    expect(io.to).toHaveBeenCalledWith(socket.id);
  });

  it('cleans up userSockets on disconnect', () => {
    const { io, triggerConnection } = createMockIo();
    setupSocketHandlers(io);

    const socket = createMockSocket(true, 'user-disconnect');
    triggerConnection(socket);
    expect(userSockets.get('user-disconnect')).toBe(socket.id);

    socket._trigger('disconnect', 'transport close');
    expect(userSockets.get('user-disconnect')).toBeUndefined();
  });
});
