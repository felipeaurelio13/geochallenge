import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Category } from '@prisma/client';
import gameRouter from '../controllers/game.controller.js';

const mocks = vi.hoisted(() => ({
  getQuestionsForGameMock: vi.fn(),
  getQuestionsForStreakGameMock: vi.fn(),
  getStreakBatchSizeMock: vi.fn(),
}));

vi.mock('../middleware/auth.js', () => ({
  authenticateJWT: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../services/game.service.js', () => ({
  getQuestionsForGame: mocks.getQuestionsForGameMock,
  getQuestionsForStreakGame: mocks.getQuestionsForStreakGameMock,
  getStreakBatchSize: mocks.getStreakBatchSizeMock,
  validateAnswerByGameType: vi.fn(),
  saveGameResult: vi.fn(),
  getUserGameHistory: vi.fn(),
}));

vi.mock('../services/leaderboard.service.js', () => ({
  updateLeaderboardScore: vi.fn(),
}));

vi.mock('../config/env.js', () => ({
  config: {
    game: {
      questionsPerGame: 10,
      timePerQuestion: 10,
      maxTimeBonus: 50,
    },
  },
}));

describe('GET /start controller gameType handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStreakBatchSizeMock.mockImplementation((count: number) => count);
    mocks.getQuestionsForGameMock.mockResolvedValue([
      { id: 'single-1', category: Category.CAPITAL, options: [], correctAnswer: 'Santiago' },
      { id: 'single-2', category: Category.CAPITAL, options: [], correctAnswer: 'Lima' },
      { id: 'single-3', category: Category.CAPITAL, options: [], correctAnswer: 'Quito' },
      { id: 'single-4', category: Category.CAPITAL, options: [], correctAnswer: 'Bogotá' },
      { id: 'single-5', category: Category.CAPITAL, options: [], correctAnswer: 'Caracas' },
      { id: 'single-6', category: Category.CAPITAL, options: [], correctAnswer: 'Brasilia' },
      { id: 'single-7', category: Category.CAPITAL, options: [], correctAnswer: 'Montevideo' },
      { id: 'single-8', category: Category.CAPITAL, options: [], correctAnswer: 'Asunción' },
      { id: 'single-9', category: Category.CAPITAL, options: [], correctAnswer: 'La Paz' },
      { id: 'single-10', category: Category.CAPITAL, options: [], correctAnswer: 'Buenos Aires' },
    ]);
    mocks.getQuestionsForStreakGameMock.mockResolvedValue([
      { id: 'streak-1', category: Category.FLAG, options: [], correctAnswer: 'Argentina' },
      { id: 'streak-2', category: Category.FLAG, options: [], correctAnswer: 'Brasil' },
      { id: 'streak-3', category: Category.FLAG, options: [], correctAnswer: 'Chile' },
      { id: 'streak-4', category: Category.FLAG, options: [], correctAnswer: 'Uruguay' },
      { id: 'streak-5', category: Category.FLAG, options: [], correctAnswer: 'Paraguay' },
      { id: 'streak-6', category: Category.FLAG, options: [], correctAnswer: 'Perú' },
      { id: 'streak-7', category: Category.FLAG, options: [], correctAnswer: 'Bolivia' },
      { id: 'streak-8', category: Category.FLAG, options: [], correctAnswer: 'Ecuador' },
      { id: 'streak-9', category: Category.FLAG, options: [], correctAnswer: 'Colombia' },
      { id: 'streak-10', category: Category.FLAG, options: [], correctAnswer: 'Venezuela' },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('acepta gameType=streak y usa la estrategia de preguntas de racha', async () => {
    const app = express();
    app.use('/api/game', gameRouter);
    const server = app.listen(0);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const response = await fetch(`${baseUrl}/api/game/start?category=FLAG&gameType=streak`);
    const body = (await response.json()) as { gameConfig: { gameType: string } };

    server.close();

    expect(response.status).toBe(200);
    expect(mocks.getQuestionsForStreakGameMock).toHaveBeenCalledWith(Category.FLAG, [], 10);
    expect(mocks.getQuestionsForGameMock).not.toHaveBeenCalled();
    expect(body.gameConfig.gameType).toBe('streak');
  });

  it('mantiene compatibilidad legacy cuando gameType no llega y usa single por default', async () => {
    const app = express();
    app.use('/api/game', gameRouter);
    const server = app.listen(0);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const response = await fetch(`${baseUrl}/api/game/start?category=CAPITAL`);
    const body = (await response.json()) as { gameConfig: { gameType: string } };

    server.close();

    expect(response.status).toBe(200);
    expect(mocks.getQuestionsForGameMock).toHaveBeenCalledWith(Category.CAPITAL, 10);
    expect(mocks.getQuestionsForStreakGameMock).not.toHaveBeenCalled();
    expect(body.gameConfig.gameType).toBe('single');
  });
});
