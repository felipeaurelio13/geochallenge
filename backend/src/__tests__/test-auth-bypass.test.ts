import { describe, expect, it } from 'vitest';
import { config, validateRuntimeEnv } from '../config/env.js';

describe('test auth bypass config', () => {
  it('mantiene bypass habilitado en NODE_ENV=test con secreto local controlado', () => {
    expect(config.testAuthBypass.enabled).toBe(true);
    expect(config.testAuthBypass.secret.length).toBeGreaterThan(0);
  });

  it('rechaza ENABLE_TEST_AUTH_BYPASS=true en producción', () => {
    expect(() =>
      validateRuntimeEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://example',
        JWT_SECRET: 'prod-secret',
        REDIS_URL: 'redis://example',
        FRONTEND_URL: 'https://example.com',
        ENABLE_TEST_AUTH_BYPASS: 'true',
      }),
    ).toThrow('ENABLE_TEST_AUTH_BYPASS must not be true in production');
  });

  it('rechaza TEST_AUTH_BYPASS_SECRET configurado en producción aunque el flag esté apagado', () => {
    expect(() =>
      validateRuntimeEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://example',
        JWT_SECRET: 'prod-secret',
        REDIS_URL: 'redis://example',
        FRONTEND_URL: 'https://example.com',
        ENABLE_TEST_AUTH_BYPASS: 'false',
        TEST_AUTH_BYPASS_SECRET: 'playwright-e2e',
      }),
    ).toThrow('TEST_AUTH_BYPASS_SECRET must not be configured in production');
  });

  it('rechaza el secreto local por defecto fuera de NODE_ENV=test', () => {
    expect(() =>
      validateRuntimeEnv({
        NODE_ENV: 'development',
        TEST_AUTH_BYPASS_SECRET: 'local-test-auth-bypass',
      }),
    ).toThrow('TEST_AUTH_BYPASS_SECRET must not use the local test default outside NODE_ENV=test');
  });

  it('permite el secreto local por defecto en NODE_ENV=test', () => {
    expect(() =>
      validateRuntimeEnv({
        NODE_ENV: 'test',
        TEST_AUTH_BYPASS_SECRET: 'local-test-auth-bypass',
      }),
    ).not.toThrow();
  });
});
