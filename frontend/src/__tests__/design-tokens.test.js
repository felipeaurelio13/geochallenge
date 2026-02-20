import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Design token system', () => {
  it('declares global token groups and automatic dark mode overrides', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

    expect(css).toContain(':root');
    expect(css).toContain('--color-primary-500');
    expect(css).toContain('--space-4');
    expect(css).toContain('--radius-2xl');
    expect(css).toContain('--shadow-lg');
    expect(css).toContain('--breakpoint-sm');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it('maps Tailwind theme.extend tokens to CSS custom properties', () => {
    const tailwindConfig = readFileSync(resolve(__dirname, '../../tailwind.config.js'), 'utf8');

    expect(tailwindConfig).toContain("'var(--color-primary-500)'");
    expect(tailwindConfig).toContain("'var(--space-3_5)'");
    expect(tailwindConfig).toContain("'var(--radius-2xl)'");
    expect(tailwindConfig).toContain("'var(--shadow-lg)'");
    expect(tailwindConfig).toContain('screens');
  });
});
