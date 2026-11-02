import { describe, it, expect, vi, afterEach } from 'vitest';
import { socketService } from '../services/socket';

describe('SocketService duel payload', () => {
  afterEach(() => {
    (socketService as any).socket = null;
  });

  it('envía timeRemaining al responder en duelo', () => {
    const emit = vi.fn();
    (socketService as any).socket = { emit };

    socketService.submitDuelAnswer('q-1', 'Chile', 17);

    expect(emit).toHaveBeenCalledWith('duel:answer', {
      questionId: 'q-1',
      answer: 'Chile',
      timeRemaining: 17,
      coordinates: undefined,
    });
  });

  it('envía coordenadas cuando la respuesta del duelo es de mapa', () => {
    const emit = vi.fn();
    (socketService as any).socket = { emit };

    socketService.submitDuelAnswer('q-map', '-34.6,-58.3', 12, { lat: -34.6, lng: -58.3 });

    expect(emit).toHaveBeenCalledWith('duel:answer', {
      questionId: 'q-map',
      answer: '-34.6,-58.3',
      timeRemaining: 12,
      coordinates: { lat: -34.6, lng: -58.3 },
    });
  });

  it('evita registrar listeners duplicados al reconectar', () => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    const mockSocket = {
      emit: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      }),
      recovered: true,
      connected: true,
    };

    (socketService as any).socket = mockSocket;
    (socketService as any).listenersAttached = false;

    // Simulate setupListeners
    (socketService as any).setupListeners();
    const countFirst = listeners['duel:queued']?.length || 0;
    expect(countFirst).toBe(1);

    // Call setupListeners again (as in reconnect)
    (socketService as any).setupListeners();
    const countSecond = listeners['duel:queued']?.length || 0;
    expect(countSecond).toBe(1);

    // After disconnect, listenersAttached resets
    socketService.disconnect();
    expect((socketService as any).listenersAttached).toBe(false);
  });
});
