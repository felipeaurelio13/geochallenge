import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapInteractive, shouldFitResultBounds, shouldResetMapView } from '../components/MapInteractive';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, className }: any) => <div data-testid="leaflet-map" className={className}>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Circle: () => null,
  useMapEvents: () => null,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() }),
}));

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

  it('renders map inside rounded surface container without overflow', () => {
    const { container } = render(
      <MapInteractive
        onLocationSelect={() => {}}
        selectedLocation={null}
        correctLocation={null}
        showResult={false}
        disabled={false}
        questionId="q-map"
      />
    );

    const mapSurface = container.querySelector('.map-surface');
    expect(mapSurface).toBeInTheDocument();
    expect(mapSurface).toHaveClass('overflow-hidden');
    expect(screen.getByTestId('leaflet-map')).toBeInTheDocument();
  });
});
