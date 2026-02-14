import { describe, expect, it } from 'vitest';
import { buildTestBypassUser, testAuthBypass } from '../utils/testAuthBypass';

describe('test auth bypass config', () => {
  it('habilita bypass en entorno de tests con valores seguros por defecto', () => {
    expect(testAuthBypass.isEnabled).toBe(true);
    expect(testAuthBypass.isConfigured).toBe(true);
    expect(testAuthBypass.secret).toBeTruthy();
  });

  it('crea un usuario estable para ejecutar tests sin login', () => {
    const user = buildTestBypassUser();

    expect(user.id).toBe('test-auth-bypass-user');
    expect(user.email).toBeTruthy();
    expect(user.username).toBeTruthy();
    expect(user.preferredLanguage).toBe('es');
  });
});
