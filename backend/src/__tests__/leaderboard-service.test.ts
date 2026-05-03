import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Redis e infra de DB ANTES de importar el servicio.
const redisMock = vi.hoisted(() => {
  const data = new Map<string, Map<string, number>>();
  return {
    data,
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      if (!data.has(key)) data.set(key, new Map());
      data.get(key)!.set(member, score);
      return 1;
    }),
    zscore: vi.fn(async (key: string, member: string) => {
      const v = data.get(key)?.get(member);
      return v === undefined ? null : String(v);
    }),
    zrevrange: vi.fn(async (key: string, start: number, stop: number, _withScores?: string) => {
      const entries = Array.from(data.get(key)?.entries() ?? []);
      entries.sort((a, b) => b[1] - a[1]);
      const sliced = stop === -1 ? entries.slice(start) : entries.slice(start, stop + 1);
      const flat: string[] = [];
      for (const [m, s] of sliced) {
        flat.push(m, String(s));
      }
      return flat;
    }),
    zrevrank: vi.fn(async (key: string, member: string) => {
      const entries = Array.from(data.get(key)?.entries() ?? []);
      entries.sort((a, b) => b[1] - a[1]);
      const idx = entries.findIndex(([m]) => m === member);
      return idx === -1 ? null : idx;
    }),
    zcard: vi.fn(async (key: string) => data.get(key)?.size ?? 0),
    del: vi.fn(async (key: string) => {
      data.delete(key);
      return 1;
    }),
    pipeline: vi.fn(() => {
      const ops: Array<() => Promise<unknown>> = [];
      const pipe = {
        zadd(key: string, score: number, member: string) {
          ops.push(() => redisMock.zadd(key, score, member));
          return pipe;
        },
        async exec() {
          for (const op of ops) await op();
          return [];
        },
      };
      return pipe;
    }),
    reset() {
      data.clear();
      this.zadd.mockClear();
      this.zscore.mockClear();
      this.zrevrange.mockClear();
      this.zrevrank.mockClear();
      this.zcard.mockClear();
      this.del.mockClear();
      this.pipeline.mockClear();
    },
  };
});

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  gameResult: {
    groupBy: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('../config/redis.js', () => ({
  getRedis: () => redisMock,
}));

vi.mock('../config/database.js', () => ({
  prisma: prismaMock,
}));

import {
  updateLeaderboardScore,
  updateSeasonLeaderboardScore,
  getTopLeaderboard,
  getSeasonLeaderboard,
  getUserRank,
  getCurrentSeasonId,
  syncLeaderboardFromDatabase,
  syncSeasonLeaderboardFromDatabase,
  recomputeAllHighScoresFromHistory,
  rebuildAllLeaderboards,
  listSeasonsWithActivity,
} from '../services/leaderboard.service.js';

beforeEach(() => {
  redisMock.reset();
  Object.values(prismaMock.user).forEach((fn) => fn.mockReset());
  Object.values(prismaMock.gameResult).forEach((fn) => fn.mockReset());
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.user.findUnique.mockResolvedValue(null);
  prismaMock.user.aggregate.mockResolvedValue({ _count: { id: 0 }, _max: { highScore: null }, _avg: { highScore: null } });
  prismaMock.user.count.mockResolvedValue(0);
  prismaMock.user.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.gameResult.groupBy.mockResolvedValue([]);
  prismaMock.gameResult.aggregate.mockResolvedValue({ _max: { score: null } });
  prismaMock.gameResult.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('updateLeaderboardScore', () => {
  it('escribe en Redis si no hay score previo', async () => {
    const ok = await updateLeaderboardScore('u1', 1000);
    expect(ok).toBe(true);
    expect(redisMock.zadd).toHaveBeenCalledWith('leaderboard:global', 1000, 'u1');
  });

  it('actualiza solo si el nuevo score es mayor (idempotente)', async () => {
    await updateLeaderboardScore('u1', 1000);
    redisMock.zadd.mockClear();

    const lower = await updateLeaderboardScore('u1', 500);
    expect(lower).toBe(false);
    expect(redisMock.zadd).not.toHaveBeenCalled();

    const higher = await updateLeaderboardScore('u1', 1500);
    expect(higher).toBe(true);
    expect(redisMock.zadd).toHaveBeenCalledWith('leaderboard:global', 1500, 'u1');
  });

  it('rechaza scores inválidos sin tocar Redis', async () => {
    expect(await updateLeaderboardScore('u1', 0)).toBe(false);
    expect(await updateLeaderboardScore('u1', -100)).toBe(false);
    expect(await updateLeaderboardScore('u1', NaN)).toBe(false);
    expect(redisMock.zadd).not.toHaveBeenCalled();
  });
});

describe('updateSeasonLeaderboardScore', () => {
  it('usa la season actual si no se especifica', async () => {
    const seasonId = getCurrentSeasonId();
    await updateSeasonLeaderboardScore('u1', 800);
    expect(redisMock.zadd).toHaveBeenCalledWith(`leaderboard:season:${seasonId}`, 800, 'u1');
  });

  it('respeta seasonId explícito', async () => {
    await updateSeasonLeaderboardScore('u1', 800, '2025-01');
    expect(redisMock.zadd).toHaveBeenCalledWith('leaderboard:season:2025-01', 800, 'u1');
  });
});

describe('getTopLeaderboard', () => {
  it('devuelve resultados de Redis con usernames y rank empezando en 1', async () => {
    await updateLeaderboardScore('u1', 1000);
    await updateLeaderboardScore('u2', 1500);
    prismaMock.user.findMany.mockResolvedValueOnce([
      { id: 'u1', username: 'alice' },
      { id: 'u2', username: 'bob' },
    ]);

    const top = await getTopLeaderboard(10);
    expect(top).toEqual([
      { rank: 1, userId: 'u2', username: 'bob', score: 1500 },
      { rank: 2, userId: 'u1', username: 'alice', score: 1000 },
    ]);
  });

  it('cae a DB cuando Redis está vacío', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      { id: 'u9', username: 'carol', highScore: 700 },
    ]);
    const top = await getTopLeaderboard(10);
    expect(top).toEqual([{ rank: 1, userId: 'u9', username: 'carol', score: 700 }]);
  });
});

describe('getUserRank', () => {
  it('devuelve rank 1-based desde Redis', async () => {
    await updateLeaderboardScore('u1', 500);
    await updateLeaderboardScore('u2', 1500);
    await updateLeaderboardScore('u3', 1000);

    const rank = await getUserRank('u3');
    expect(rank).toEqual({ rank: 2, score: 1000 });
  });

  it('cae a DB cuando el usuario no existe en Redis', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ highScore: 1234 });
    prismaMock.user.count.mockResolvedValueOnce(5);
    const rank = await getUserRank('cold-user');
    expect(rank).toEqual({ rank: 6, score: 1234 });
  });
});

describe('syncLeaderboardFromDatabase', () => {
  it('reconstruye Redis desde User.highScore sin tope', async () => {
    const users = Array.from({ length: 1500 }, (_, i) => ({
      id: `u${i}`,
      highScore: 1500 - i,
    }));
    prismaMock.user.findMany.mockResolvedValueOnce(users);

    const loaded = await syncLeaderboardFromDatabase();
    expect(loaded).toBe(1500);
    expect(redisMock.del).toHaveBeenCalledWith('leaderboard:global');
    expect(redisMock.data.get('leaderboard:global')?.size).toBe(1500);
  });
});

describe('syncSeasonLeaderboardFromDatabase', () => {
  it('agrega max(score) por usuario para la season indicada', async () => {
    prismaMock.gameResult.groupBy.mockResolvedValueOnce([
      { userId: 'u1', _max: { score: 800 } },
      { userId: 'u2', _max: { score: 1200 } },
      { userId: 'u3', _max: { score: 0 } },
      { userId: 'u4', _max: { score: null } },
    ]);

    const loaded = await syncSeasonLeaderboardFromDatabase('2025-03');
    expect(loaded).toBe(2);
    expect(redisMock.data.get('leaderboard:season:2025-03')?.size).toBe(2);
    expect(redisMock.data.get('leaderboard:season:2025-03')?.get('u2')).toBe(1200);
  });
});

describe('recomputeAllHighScoresFromHistory', () => {
  it('actualiza User.highScore solo si el max real es mayor que el actual', async () => {
    prismaMock.gameResult.groupBy.mockResolvedValueOnce([
      { userId: 'u1', _max: { score: 1500 } },
      { userId: 'u2', _max: { score: 0 } },
      { userId: 'u3', _max: { score: 800 } },
    ]);
    prismaMock.user.updateMany
      .mockResolvedValueOnce({ count: 1 }) // u1 updated
      .mockResolvedValueOnce({ count: 0 }); // u3 no-op (highScore ya >=)

    const result = await recomputeAllHighScoresFromHistory();
    expect(result.scanned).toBe(3);
    expect(result.updated).toBe(1);
    expect(prismaMock.user.updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', highScore: { lt: 1500 } },
      data: { highScore: 1500 },
    });
  });
});

describe('listSeasonsWithActivity', () => {
  it('extrae seasons únicos YYYY-MM ordenados', async () => {
    prismaMock.gameResult.findMany.mockResolvedValueOnce([
      { createdAt: new Date(Date.UTC(2025, 0, 5)) },
      { createdAt: new Date(Date.UTC(2025, 0, 25)) },
      { createdAt: new Date(Date.UTC(2025, 2, 1)) },
      { createdAt: new Date(Date.UTC(2026, 4, 10)) },
    ]);

    const seasons = await listSeasonsWithActivity();
    expect(seasons).toEqual(['2025-01', '2025-03', '2026-05']);
  });
});

describe('rebuildAllLeaderboards', () => {
  it('encadena recomputo de highScores + sync global + sync por season', async () => {
    prismaMock.gameResult.groupBy
      .mockResolvedValueOnce([{ userId: 'u1', _max: { score: 2000 } }]) // recompute
      .mockResolvedValueOnce([{ userId: 'u1', _max: { score: 2000 } }]); // first season sync
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'u1', highScore: 2000 }]);
    prismaMock.gameResult.findMany.mockResolvedValueOnce([
      { createdAt: new Date(Date.UTC(2026, 4, 1)) },
    ]);

    const result = await rebuildAllLeaderboards();
    expect(result.highScoresUpdated).toBe(1);
    expect(result.globalLoaded).toBe(1);
    expect(result.seasonsLoaded).toEqual([{ seasonId: '2026-05', loaded: 1 }]);
  });
});

describe('getSeasonLeaderboard', () => {
  it('cae a DB cuando Redis está vacío', async () => {
    prismaMock.gameResult.groupBy.mockResolvedValueOnce([
      { userId: 'u1', _max: { score: 900 } },
    ]);
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'u1', username: 'eve' }]);

    const result = await getSeasonLeaderboard(10, '2025-01');
    expect(result).toEqual([{ rank: 1, userId: 'u1', username: 'eve', score: 900 }]);
  });
});
