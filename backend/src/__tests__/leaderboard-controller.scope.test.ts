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

  it('acepta global como scope válido', () => {
    expect(resolveLeaderboardScope('global')).toEqual({
      requestedScope: 'global',
      effectiveScope: 'global',
      fallbackApplied: false,
    });
  });

  it('acepta season como scope válido', () => {
    expect(resolveLeaderboardScope('season')).toEqual({
      requestedScope: 'season',
      effectiveScope: 'season',
      fallbackApplied: false,
    });
  });

  it('normaliza valores inválidos a global y reporta fallback', () => {
    expect(resolveLeaderboardScope('weekly')).toEqual({
      requestedScope: 'global',
      effectiveScope: 'global',
      fallbackApplied: true,
    });
    expect(resolveLeaderboardScope('friends')).toEqual({
      requestedScope: 'global',
      effectiveScope: 'global',
      fallbackApplied: true,
    });
    expect(resolveLeaderboardScope('invalid')).toEqual({
      requestedScope: 'global',
      effectiveScope: 'global',
      fallbackApplied: true,
    });
  });

  it('es case-insensitive y acepta no-strings sin romper', () => {
    expect(resolveLeaderboardScope('SEASON')).toEqual({
      requestedScope: 'season',
      effectiveScope: 'season',
      fallbackApplied: false,
    });
    expect(resolveLeaderboardScope(null)).toEqual({
      requestedScope: 'global',
      effectiveScope: 'global',
      fallbackApplied: false,
    });
    expect(resolveLeaderboardScope(123)).toEqual({
      requestedScope: 'global',
      effectiveScope: 'global',
      fallbackApplied: false,
    });
  });
});
