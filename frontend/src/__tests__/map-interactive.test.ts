import { describe, expect, it } from 'vitest';
import { shouldFitResultBounds, shouldResetMapView } from '../components/MapInteractive';

describe('MapInteractive viewport behavior', () => {
  it('returns true only when result view has both selected and correct locations', () => {
    expect(
      shouldFitResultBounds(true, { lat: -33.45, lng: -70.66 }, { lat: 40.71, lng: -74.0 })
    ).toBe(true);

    expect(shouldFitResultBounds(false, { lat: -33.45, lng: -70.66 }, { lat: 40.71, lng: -74.0 })).toBe(false);
    expect(shouldFitResultBounds(true, null, { lat: 40.71, lng: -74.0 })).toBe(false);
    expect(shouldFitResultBounds(true, { lat: -33.45, lng: -70.66 }, null)).toBe(false);
  });
});


describe('MapInteractive neutral viewport reset', () => {
  it('resets to neutral view only while selecting a new answer', () => {
    expect(shouldResetMapView(false)).toBe(true);
    expect(shouldResetMapView(true)).toBe(false);
  });
});
