import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('quality tooling configuration', () => {
  it('configures lint and tests in GitHub pull request workflows', () => {
    const frontendWorkflowPath = resolve(__dirname, '../../../.github/workflows/frontend-quality.yml');
    const backendWorkflowPath = resolve(__dirname, '../../../.github/workflows/backend-quality.yml');

    const frontendWorkflow = readFileSync(frontendWorkflowPath, 'utf-8');
    const backendWorkflow = readFileSync(backendWorkflowPath, 'utf-8');

    expect(frontendWorkflow).toContain('pull_request:');
    expect(frontendWorkflow).toContain('run: npm run lint');
    expect(frontendWorkflow).toContain('run: npm run test');

    expect(backendWorkflow).toContain('pull_request:');
    expect(backendWorkflow).toContain('run: npm run lint');
    expect(backendWorkflow).toContain('run: npm run test');
  });

  it('registers a pre-commit hook that runs lint-staged', () => {
    const preCommitPath = resolve(__dirname, '../../../.husky/pre-commit');
    const preCommitContent = readFileSync(preCommitPath, 'utf-8');

    expect(preCommitContent).toContain('npx lint-staged');
  });
});
