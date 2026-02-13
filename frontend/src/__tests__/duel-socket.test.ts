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
});
