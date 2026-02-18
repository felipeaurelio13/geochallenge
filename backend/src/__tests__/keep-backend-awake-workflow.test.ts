import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('keep-backend-awake workflow', () => {
  it('warns and exits successfully when BACKEND_HEALTHCHECK_URL is missing', () => {
    const workflowPath = resolve(__dirname, '../../../.github/workflows/keep-backend-awake.yml');
    const workflowContent = readFileSync(workflowPath, 'utf-8');

    expect(workflowContent).toContain('::warning::BACKEND_HEALTHCHECK_URL is not configured; skipping backend ping.');
    expect(workflowContent).toContain('exit 0');
  });
});
