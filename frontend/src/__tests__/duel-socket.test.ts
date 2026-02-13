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
    });
  });
});
