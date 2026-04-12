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

  it('acepta season como scope válido', () => {
    expect(resolveLeaderboardScope('season')).toEqual({
      requestedScope: 'season',
      effectiveScope: 'season',
      fallbackApplied: false,
    });
  });

  it('normaliza valores inválidos a global sin romper compatibilidad', () => {
    expect(resolveLeaderboardScope('invalid')).toEqual({
      requestedScope: 'global',
      effectiveScope: 'global',
      fallbackApplied: false,
    });
  });
});
