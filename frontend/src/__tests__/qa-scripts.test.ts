import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(path.resolve(currentDir, '../../package.json'), 'utf-8'),
) as {
  scripts?: Record<string, string>;
};

describe('qa scripts', () => {
  it('mantiene scripts de lint y e2e consistentes para local y CI', () => {
    expect(packageJson.scripts?.lint).toBe(
      'eslint . --ext .ts,.tsx --report-unused-disable-directives --max-warnings 0',
    );
    expect(packageJson.scripts?.['test:e2e']).toContain('test:e2e:install');
    expect(packageJson.scripts?.['test:e2e:ci']).toContain('install --with-deps chromium');
    expect(packageJson.scripts?.['test:e2e:ci']).toContain('playwright test');
  });
});
