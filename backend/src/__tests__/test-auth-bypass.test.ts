import { describe, expect, it } from 'vitest';
import { config } from '../config/env.js';

describe('test auth bypass config', () => {
  it('mantiene bypass apagado por defecto fuera de testing', () => {
    if (process.env.NODE_ENV !== 'test') {
      expect(config.testAuthBypass.enabled).toBe(false);
      return;
    }

    expect(config.testAuthBypass.enabled).toBe(true);
    expect(config.testAuthBypass.secret.length).toBeGreaterThan(0);
  });
});
