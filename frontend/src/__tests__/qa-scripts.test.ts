import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

describe('qa scripts', () => {
  it('mantiene scripts de lint y e2e consistentes para local y CI', () => {
    const typedPackageJson = packageJson as {
      scripts?: Record<string, string>;
    };

    expect(typedPackageJson.scripts?.lint).toBe(
      'eslint . --ext .ts,.tsx --report-unused-disable-directives --max-warnings 0',
    );
    expect(typedPackageJson.scripts?.['test:e2e']).toContain('test:e2e:install');
    expect(typedPackageJson.scripts?.['test:e2e:ci']).toContain('install --with-deps chromium');
    expect(typedPackageJson.scripts?.['test:e2e:ci']).toContain('playwright test');
  });
});
