import packageJson from '../../package.json';
import { describe, expect, it } from 'vitest';

type PackageJson = {
  scripts?: Record<string, string>;
};

const scripts = (packageJson as PackageJson).scripts;

describe('qa scripts', () => {
  it('mantiene scripts de lint y e2e consistentes para local y CI', () => {
    expect(scripts?.lint).toBe(
      'eslint . --ext .ts,.tsx --report-unused-disable-directives --max-warnings 0',
    );
    expect(scripts?.['test:e2e']).toContain('test:e2e:install');
    expect(scripts?.['test:e2e:ci']).toContain('install --with-deps chromium');
    expect(scripts?.['test:e2e:ci']).toContain('playwright test');
  });
});
