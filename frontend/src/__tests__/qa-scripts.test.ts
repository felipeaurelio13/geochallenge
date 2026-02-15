import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('qa scripts', () => {
  it('mantiene scripts de lint y e2e consistentes para local y CI', () => {
    const packageJsonPath = resolve(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.lint).toBe(
      'eslint . --ext .ts,.tsx --report-unused-disable-directives --max-warnings 0',
    );
    expect(packageJson.scripts?.['test:e2e']).toContain('test:e2e:install');
    expect(packageJson.scripts?.['test:e2e:ci']).toContain('install --with-deps chromium');
    expect(packageJson.scripts?.['test:e2e:ci']).toContain('playwright@1.51.1 test');
  });
});
