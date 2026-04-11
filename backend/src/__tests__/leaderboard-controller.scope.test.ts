import { describe, expect, it } from 'vitest';
import { resolveLeaderboardScope } from '../controllers/leaderboard.controller.js';

describe('resolveLeaderboardScope', () => {
  it('usa global por defecto cuando no se envía scope', () => {
    expect(resolveLeaderboardScope(undefined)).toEqual({
      requestedScope: 'global',
      effectiveScope: 'global',
      fallbackApplied: false,
    });
  });

  it('degrada weekly a global y marca fallbackApplied', () => {
    expect(resolveLeaderboardScope('weekly')).toEqual({
      requestedScope: 'weekly',
      effectiveScope: 'global',
      fallbackApplied: true,
    });
  });

  it('degrada friends a global y marca fallbackApplied', () => {
    expect(resolveLeaderboardScope('friends')).toEqual({
      requestedScope: 'friends',
      effectiveScope: 'global',
      fallbackApplied: true,
    });
  });

  it('normaliza valores inválidos a global sin fallback', () => {
    expect(resolveLeaderboardScope('invalid')).toEqual({
      requestedScope: 'global',
      effectiveScope: 'global',
      fallbackApplied: false,
    });
  });
});
