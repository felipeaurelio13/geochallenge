import { describe, expect, it } from 'vitest';
import appFile from '../App.tsx?raw';

describe('App routing game state scope', () => {
  it('wraps app with a single shared GameProvider in AppWrapper', () => {
    expect(appFile).toContain('<GameProvider>{children}</GameProvider>');
  });

  it('does not create per-route GameProvider instances for single game and results routes', () => {
    const singleRouteLine = "path: '/game/single'";
    const resultsRouteLine = "path: '/results'";

    const singleRouteIndex = appFile.indexOf(singleRouteLine);
    const resultsRouteIndex = appFile.indexOf(resultsRouteLine);

    expect(singleRouteIndex).toBeGreaterThan(-1);
    expect(resultsRouteIndex).toBeGreaterThan(-1);

    const singleRouteSlice = appFile.slice(singleRouteIndex, singleRouteIndex + 220);
    const resultsRouteSlice = appFile.slice(resultsRouteIndex, resultsRouteIndex + 220);

    expect(singleRouteSlice).not.toContain('<GameProvider>');
    expect(resultsRouteSlice).not.toContain('<GameProvider>');
  });
});
