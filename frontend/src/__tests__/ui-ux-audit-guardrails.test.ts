import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
const gameRoundScaffold = readFileSync(resolve(__dirname, '../components/GameRoundScaffold.tsx'), 'utf8');
const universalLayout = readFileSync(resolve(__dirname, '../components/UniversalGameLayout.tsx'), 'utf8');

function getUnsafeVhMatches(source: string) {
  return source.match(/\b\d+vh\b/g) ?? [];
}

describe('UI/UX guardrails audit (mobile-first)', () => {
  it('keeps universal game shell in a 3-row grid with dvh and hidden overflow', () => {
    expect(css).toContain('.universal-layout');
    expect(css).toContain('grid-template-rows: auto minmax(0, 1fr) auto;');
    expect(css).toContain('height: 100dvh;');
    expect(css).toContain('min-height: 100dvh;');
    expect(css).toContain('overflow: hidden;');
    expect(universalLayout).toContain('data-testid="universal-layout-main"');
    expect(universalLayout).toContain('data-testid="universal-layout-footer"');
  });

  it('protects safe areas and bounce behavior for mobile gameplay surfaces', () => {
    expect(css).toContain('padding-top: env(safe-area-inset-top);');
    expect(css).toContain('padding-bottom: env(safe-area-inset-bottom);');
    expect(css).toContain('overscroll-behavior: none;');
    expect(css).toContain('overscroll-behavior: contain;');
  });

  it('does not use legacy vh units in core stylesheet', () => {
    const unsafe = getUnsafeVhMatches(css);
    expect(unsafe).toEqual([]);
  });

  it('keeps capitals vertically centered and media questions in content-sized mode', () => {
    expect(gameRoundScaffold).toContain('game-question-wrap--capital flex flex-1 items-center');
    expect(gameRoundScaffold).toContain('game-question-wrap--media');
  });

  it('keeps 4 visible options and solid-state option backgrounds guardrail by class contract', () => {
    expect(css).toContain('grid-template-rows: repeat(4, minmax(0, 1fr));');
    expect(css).toContain('.option-button-base');
    expect(css).toContain('padding-top: clamp(var(--space-1_5), 1.2dvh, var(--space-3));');
    expect(css).toContain('padding-bottom: clamp(var(--space-1_5), 1.2dvh, var(--space-3));');
  });
});
