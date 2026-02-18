import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('frontend deploy workflow', () => {
  it('runs a quality gate before deploying to GitHub Pages', () => {
    const workflowPath = resolve(__dirname, '../../../.github/workflows/deploy-frontend-pages.yml');
    const workflowContent = readFileSync(workflowPath, 'utf-8');

    expect(workflowContent).toContain('name: Frontend quality gate');
    expect(workflowContent).toContain('needs: quality-gate');
    expect(workflowContent).toContain('actions/deploy-pages@v4');
    expect(workflowContent).toContain('VITE_BASE_PATH: /${{ github.event.repository.name }}/');
    expect(workflowContent).toContain("run: npm run ci:quality");
    expect(workflowContent).toContain("paths:");
  });

  it('uses a configurable base path for GitHub Pages builds and a shared quality script', () => {
    const viteConfigPath = resolve(__dirname, '../../../frontend/vite.config.ts');
    const viteConfigContent = readFileSync(viteConfigPath, 'utf-8');

    expect(viteConfigContent).toContain("base: process.env.VITE_BASE_PATH ?? '/'");

    const frontendPackagePath = resolve(__dirname, '../../../frontend/package.json');
    const frontendPackageContent = readFileSync(frontendPackagePath, 'utf-8');

    expect(frontendPackageContent).toContain('\"ci:quality\"');
  });
});
