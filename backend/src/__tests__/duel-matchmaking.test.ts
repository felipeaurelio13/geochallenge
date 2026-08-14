import { describe, expect, it } from 'vitest';
import { CompetitiveLadder } from '@prisma/client';
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

  it('no empareja casual con ranked', () => {
    const queue = new MatchmakingQueue();

    queue.addPlayer({
      userId: 'u1', username: 'uno', socketId: 's1', joinedAt: new Date('2026-01-01T00:00:00Z'),
      category: 'MIXED', mode: 'classic',
    });
    queue.addPlayer({
      userId: 'u2', username: 'dos', socketId: 's2', joinedAt: new Date('2026-01-01T00:00:01Z'),
      category: 'MIXED', mode: 'classic', rated: true, ladder: CompetitiveLadder.CLASSIC, rating: 1000,
    });

    expect(queue.findMatch()).toBeNull();
  });

  it('no empareja Ranked Classic con Ranked GeoRetos', () => {
    const queue = new MatchmakingQueue();

    queue.addPlayer({
      userId: 'u1', username: 'uno', socketId: 's1', joinedAt: new Date('2026-01-01T00:00:00Z'),
      category: 'MIXED', mode: 'classic', rated: true, ladder: CompetitiveLadder.CLASSIC, rating: 1000,
    });
    queue.addPlayer({
      userId: 'u2', username: 'dos', socketId: 's2', joinedAt: new Date('2026-01-01T00:00:01Z'),
      category: 'MIXED', mode: 'geo-challenge', rated: true, ladder: CompetitiveLadder.GEO_CHALLENGE, rating: 1000,
    });

    expect(queue.findMatch()).toBeNull();
  });

  it('elige el rival ranked con rating más cercano', () => {
    const queue = new MatchmakingQueue();

    queue.addPlayer({
      userId: 'u1', username: 'uno', socketId: 's1', joinedAt: new Date('2026-01-01T00:00:00Z'),
      category: 'MIXED', mode: 'classic', rated: true, ladder: CompetitiveLadder.CLASSIC, rating: 1000,
    });
    queue.addPlayer({
      userId: 'u2', username: 'dos', socketId: 's2', joinedAt: new Date('2026-01-01T00:00:01Z'),
      category: 'MIXED', mode: 'classic', rated: true, ladder: CompetitiveLadder.CLASSIC, rating: 1300,
    });
    queue.addPlayer({
      userId: 'u3', username: 'tres', socketId: 's3', joinedAt: new Date('2026-01-01T00:00:02Z'),
      category: 'MIXED', mode: 'classic', rated: true, ladder: CompetitiveLadder.CLASSIC, rating: 1010,
    });

    expect(queue.findMatch()?.map((player) => player.userId)).toEqual(['u1', 'u3']);
  });

  it('fuerza Ranked Classic a MIXED y descarta filtros maliciosos', () => {
    const queue = new MatchmakingQueue();

    queue.addPlayer({
      userId: 'u1', username: 'uno', socketId: 's1', joinedAt: new Date('2026-01-01T00:00:00Z'),
      category: 'FLAG', filters: { continent: 'Europe', isInsular: true }, mode: 'classic',
      rated: true, ladder: CompetitiveLadder.CLASSIC, rating: 1000,
    });
    queue.addPlayer({
      userId: 'u2', username: 'dos', socketId: 's2', joinedAt: new Date('2026-01-01T00:00:01Z'),
      category: 'CAPITAL', filters: { difficulty: 'HARD' }, mode: 'classic',
      rated: true, ladder: CompetitiveLadder.CLASSIC, rating: 1000,
    });

    const match = queue.findMatch();
    expect(match?.[0]).toMatchObject({
      category: 'MIXED',
      filters: undefined,
      ladder: CompetitiveLadder.CLASSIC,
    });
    expect(match?.[1]).toMatchObject({
      category: 'MIXED',
      filters: undefined,
      ladder: CompetitiveLadder.CLASSIC,
    });
  });

  it('en empate de distancia ranked elige al candidato más antiguo', () => {
    const queue = new MatchmakingQueue();

    queue.addPlayer({
      userId: 'u1', username: 'uno', socketId: 's1', joinedAt: new Date('2026-01-01T00:00:00Z'),
      category: 'MIXED', mode: 'classic', rated: true, ladder: CompetitiveLadder.CLASSIC, rating: 1000,
    });
    queue.addPlayer({
      userId: 'u2', username: 'dos', socketId: 's2', joinedAt: new Date('2026-01-01T00:00:01Z'),
      category: 'MIXED', mode: 'classic', rated: true, ladder: CompetitiveLadder.CLASSIC, rating: 990,
    });
    queue.addPlayer({
      userId: 'u3', username: 'tres', socketId: 's3', joinedAt: new Date('2026-01-01T00:00:02Z'),
      category: 'MIXED', mode: 'classic', rated: true, ladder: CompetitiveLadder.CLASSIC, rating: 1010,
    });

    expect(queue.findMatch()?.map((player) => player.userId)).toEqual(['u1', 'u2']);
  });

  it('mantiene FIFO casual', () => {
    const queue = new MatchmakingQueue();

    queue.addPlayer({
      userId: 'u1', username: 'uno', socketId: 's1', joinedAt: new Date('2026-01-01T00:00:00Z'),
      category: 'FLAG', mode: 'classic',
    });
    queue.addPlayer({
      userId: 'u2', username: 'dos', socketId: 's2', joinedAt: new Date('2026-01-01T00:00:01Z'),
      category: 'FLAG', mode: 'classic',
    });
    queue.addPlayer({
      userId: 'u3', username: 'tres', socketId: 's3', joinedAt: new Date('2026-01-01T00:00:02Z'),
      category: 'FLAG', mode: 'classic',
    });

    expect(queue.findMatch()?.map((player) => player.userId)).toEqual(['u1', 'u2']);
  });
});
