import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapInteractive, shouldFitResultBounds, shouldResetMapView } from '../components/MapInteractive';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mocks = vi.hoisted(() => ({
  fakeMap: {
    fitBounds: vi.fn(),
    setView: vi.fn(),
    panBy: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 12.5, lng: -34.5 })),
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, className }: any) => <div data-testid="leaflet-map" className={className}>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Circle: () => null,
  useMapEvents: () => null,
  useMap: () => mocks.fakeMap,
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

describe('MapInteractive keyboard support (a11y phase 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderMap(overrides: Partial<ComponentProps<typeof MapInteractive>> = {}) {
    const onLocationSelect = vi.fn();
    const { container } = render(
      <MapInteractive
        onLocationSelect={onLocationSelect}
        selectedLocation={null}
        correctLocation={null}
        showResult={false}
        disabled={false}
        questionId="q-map"
        {...overrides}
      />
    );
    const surface = container.querySelector('.map-surface') as HTMLElement;
    return { surface, onLocationSelect };
  }

  it('exposes a focusable, labeled container with usage instructions', () => {
    const { surface } = renderMap();
    expect(surface).toHaveAttribute('tabIndex', '0');
    expect(surface).toHaveAttribute('aria-label', 'map.keyboardInstructions');
    expect(screen.getByText('map.keyboardInstructions')).toBeInTheDocument();
  });

  it('pans the map on arrow keys', () => {
    const { surface } = renderMap();
    fireEvent.keyDown(surface, { key: 'ArrowUp' });
    fireEvent.keyDown(surface, { key: 'ArrowDown' });
    fireEvent.keyDown(surface, { key: 'ArrowLeft' });
    fireEvent.keyDown(surface, { key: 'ArrowRight' });
    expect(mocks.fakeMap.panBy).toHaveBeenCalledTimes(4);
  });

  it('zooms in and out on +/- keys', () => {
    const { surface } = renderMap();
    fireEvent.keyDown(surface, { key: '+' });
    fireEvent.keyDown(surface, { key: '=' });
    fireEvent.keyDown(surface, { key: '-' });
    expect(mocks.fakeMap.zoomIn).toHaveBeenCalledTimes(2);
    expect(mocks.fakeMap.zoomOut).toHaveBeenCalledTimes(1);
  });

  it('places the answer at the map center on Enter/Space', () => {
    const { surface, onLocationSelect } = renderMap();
    fireEvent.keyDown(surface, { key: 'Enter' });
    expect(onLocationSelect).toHaveBeenCalledWith(12.5, -34.5);

    onLocationSelect.mockClear();
    fireEvent.keyDown(surface, { key: ' ' });
    expect(onLocationSelect).toHaveBeenCalledWith(12.5, -34.5);
  });

  it('ignores keyboard input while disabled or showing the result', () => {
    const { surface, onLocationSelect } = renderMap({ disabled: true });
    fireEvent.keyDown(surface, { key: 'ArrowUp' });
    fireEvent.keyDown(surface, { key: 'Enter' });
    expect(mocks.fakeMap.panBy).not.toHaveBeenCalled();
    expect(onLocationSelect).not.toHaveBeenCalled();
  });

  it('does not place a new marker via Enter once the result is already shown', () => {
    const { surface, onLocationSelect } = renderMap({ showResult: true });
    fireEvent.keyDown(surface, { key: 'Enter' });
    expect(onLocationSelect).not.toHaveBeenCalled();
  });
});
