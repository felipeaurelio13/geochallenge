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

  it('separa la cola clásica de la cola GeoRetos', () => {
    const queue = new MatchmakingQueue();

    queue.addPlayer({
      userId: 'u1', username: 'uno', socketId: 's1', joinedAt: new Date(),
      category: 'MIXED', mode: 'classic',
    });
    queue.addPlayer({
      userId: 'u2', username: 'dos', socketId: 's2', joinedAt: new Date(),
      category: 'MIXED', mode: 'geo-challenge',
    });

    expect(queue.findMatch()).toBeNull();

    queue.addPlayer({
      userId: 'u3', username: 'tres', socketId: 's3', joinedAt: new Date(),
      category: 'MIXED', mode: 'geo-challenge',
    });

    const match = queue.findMatch();
    expect(match?.map((player) => player.userId)).toEqual(['u2', 'u3']);
  });
});
