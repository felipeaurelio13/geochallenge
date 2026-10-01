import express from 'express';
import { AddressInfo } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import leaderboardRouter from '../controllers/leaderboard.controller.js';

const mocks = vi.hoisted(() => ({
  rebuildAll: vi.fn(),
}));

vi.mock('../config/env.js', () => ({
  config: { adminToken: 'super-secret-admin-token' },
}));

vi.mock('../middleware/auth.js', () => ({
  authenticateJWT: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../services/leaderboard.service.js', () => ({
  getTopLeaderboard: vi.fn(),
  getSeasonLeaderboard: vi.fn(),
  getUserRank: vi.fn(),
  getSeasonUserRank: vi.fn(),
  getLeaderboardStats: vi.fn(),
  getSeasonLeaderboardStats: vi.fn(),
  getUserLeaderboardContext: vi.fn(),
  getCurrentSeasonId: vi.fn(() => '2026-10'),
  listSeasonsWithActivity: vi.fn(),
  syncLeaderboardFromDatabase: vi.fn(),
  syncSeasonLeaderboardFromDatabase: vi.fn(),
  rebuildAllLeaderboards: mocks.rebuildAll,
}));

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/leaderboard', leaderboardRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

async function rebuild(baseUrl: string, token?: string) {
  const res = await fetch(`${baseUrl}/api/leaderboard/admin/rebuild`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token !== undefined ? { 'x-admin-token': token } : {}) },
    body: JSON.stringify({}),
  });
  return res.status;
}

describe('POST /api/leaderboard/admin/rebuild — token admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rebuildAll.mockResolvedValue({ global: 1, seasons: 0 });
  });

  it('token correcto → 200', async () => {
    const { server, baseUrl } = startServer();
    const status = await rebuild(baseUrl, 'super-secret-admin-token');
    server.close();
    expect(status).toBe(200);
    expect(mocks.rebuildAll).toHaveBeenCalledTimes(1);
  });

  it('token ausente, incorrecto, de otra longitud o prefijo → 401', async () => {
    const { server, baseUrl } = startServer();
    const statuses = await Promise.all([
      rebuild(baseUrl),
      rebuild(baseUrl, 'wrong'),
      rebuild(baseUrl, 'super-secret-admin-token-extra'),
      rebuild(baseUrl, 'super-secret-admin-toke'),
      rebuild(baseUrl, ''),
    ]);
    server.close();
    expect(statuses).toEqual([401, 401, 401, 401, 401]);
    expect(mocks.rebuildAll).not.toHaveBeenCalled();
  });
});
