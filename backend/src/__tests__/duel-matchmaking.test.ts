import { describe, expect, it } from 'vitest';
import { MatchmakingQueue } from '../sockets/duel.handler.js';

describe('duel matchmaking by category', () => {
  it('empareja solo jugadores de la misma categoría', () => {
    const queue = new MatchmakingQueue();

    queue.addPlayer({
      userId: 'u1',
      username: 'uno',
      socketId: 's1',
      joinedAt: new Date(),
      category: 'FLAG',
    });

    queue.addPlayer({
      userId: 'u2',
      username: 'dos',
      socketId: 's2',
      joinedAt: new Date(),
      category: 'CAPITAL',
    });

    expect(queue.findMatch()).toBeNull();
  });

  it('encuentra match cuando ambos eligieron la misma categoría', () => {
    const queue = new MatchmakingQueue();

    queue.addPlayer({
      userId: 'u1',
      username: 'uno',
      socketId: 's1',
      joinedAt: new Date(),
      category: 'MIXED',
    });

    queue.addPlayer({
      userId: 'u2',
      username: 'dos',
      socketId: 's2',
      joinedAt: new Date(),
      category: 'MIXED',
    });

    const match = queue.findMatch();

    expect(match).not.toBeNull();
    expect(match?.[0].category).toBe('MIXED');
    expect(match?.[1].category).toBe('MIXED');
  });
});
