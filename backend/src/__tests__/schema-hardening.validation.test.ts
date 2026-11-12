import { describe, expect, it } from 'vitest';
import { startGameSchema, finishGameSchema, answerSchema as gameAnswerSchema } from '../controllers/game.controller.js';
import { createChallengeSchema } from '../controllers/challenge.controller.js';
import { answerSchema as flagMasterAnswerSchema, finishSchema as flagMasterFinishSchema } from '../controllers/flagMaster.controller.js';
import { answerSchema as geoChallengeAnswerSchema, finishSchema as geoChallengeFinishSchema } from '../controllers/geoChallenge.controller.js';

describe('Schema hardening & collection bounds (anti-DoS / memory exhaustion)', () => {
  describe('game.controller schemas', () => {
    it('rechaza excludeIds con más de 500 elementos', () => {
      const hugeExclude = Array.from({ length: 501 }, (_, i) => `id-${i}`);
      expect(() =>
        startGameSchema.parse({
          gameType: 'streak',
          excludeIds: hugeExclude,
        })
      ).toThrow();
    });

    it('rechaza excludeIds con elementos que excedan 100 caracteres', () => {
      expect(() =>
        startGameSchema.parse({
          gameType: 'streak',
          excludeIds: ['a'.repeat(101)],
        })
      ).toThrow();
    });

    it('rechaza filtros de continente que excedan 50 caracteres', () => {
      expect(() =>
        startGameSchema.parse({
          continent: 'a'.repeat(51),
        })
      ).toThrow();
    });

    it('rechaza respuestas de juego con respuesta mayor a 200 caracteres', () => {
      expect(() =>
        gameAnswerSchema.parse({
          questionId: 'q-1',
          answer: 'x'.repeat(201),
          timeRemaining: 5,
        })
      ).toThrow();
    });

    it('rechaza finishGame con más de 100 respuestas', () => {
      const hugeAnswers = Array.from({ length: 101 }, (_, i) => ({
        questionId: `q-${i}`,
        answer: 'test',
        timeRemaining: 10,
      }));
      expect(() =>
        finishGameSchema.parse({
          sessionId: 'session-1',
          answers: hugeAnswers,
        })
      ).toThrow();
    });
  });

  describe('challenge.controller schemas', () => {
    it('rechaza más de 10 categorías en createChallenge', () => {
      const excessiveCategories = Array.from({ length: 11 }, () => 'FLAG');
      expect(() =>
        createChallengeSchema.parse({
          categories: excessiveCategories,
          maxPlayers: 4,
          answerTimeSeconds: 20,
        })
      ).toThrow();
    });

    it('rechaza continente mayor a 50 caracteres en filtros de reto', () => {
      expect(() =>
        createChallengeSchema.parse({
          categories: ['FLAG'],
          maxPlayers: 4,
          answerTimeSeconds: 20,
          filters: { continent: 'x'.repeat(51) },
        })
      ).toThrow();
    });
  });

  describe('flagMaster.controller schemas', () => {
    it('valida respuesta legítima de Flag Master', () => {
      const valid = flagMasterAnswerSchema.parse({
        gameId: 'game-1',
        questionId: 'q-1',
        answer: 'France',
        timeRemaining: 8,
      });
      expect(valid.gameId).toBe('game-1');
    });

    it('rechaza respuesta de Flag Master con respuesta mayor a 200 caracteres', () => {
      expect(() =>
        flagMasterAnswerSchema.parse({
          gameId: 'game-1',
          questionId: 'q-1',
          answer: 'x'.repeat(201),
          timeRemaining: 8,
        })
      ).toThrow();
    });

    it('rechaza finalización de Flag Master con más de 20 respuestas', () => {
      const hugeAnswers = Array.from({ length: 21 }, (_, i) => ({
        questionId: `q-${i}`,
        answer: 'ans',
        timeRemaining: 5,
      }));
      expect(() =>
        flagMasterFinishSchema.parse({
          gameId: 'game-1',
          answers: hugeAnswers,
        })
      ).toThrow();
    });
  });

  describe('geoChallenge.controller schemas', () => {
    it('rechaza más de 4 opciones seleccionadas', () => {
      expect(() =>
        geoChallengeAnswerSchema.parse({
          sessionToken: 'token-abc',
          roundId: 'r-1',
          selectedOptionIds: ['1', '2', '3', '4', '5'],
        })
      ).toThrow();
    });

    it('rechaza sessionToken mayor a 32768 caracteres', () => {
      expect(() =>
        geoChallengeAnswerSchema.parse({
          sessionToken: 'x'.repeat(32769),
          roundId: 'r-1',
          selectedOptionIds: ['1'],
        })
      ).toThrow();
    });

    it('rechaza finish de GeoChallenge con más de 10 respuestas', () => {
      const hugeAnswers = Array.from({ length: 11 }, (_, i) => ({
        roundId: `r-${i}`,
        selectedOptionIds: ['1'],
      }));
      expect(() =>
        geoChallengeFinishSchema.parse({
          sessionToken: 'token-abc',
          answers: hugeAnswers,
        })
      ).toThrow();
    });
  });
});
