import { useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Circle, useMap } from 'react-leaflet';
import { Icon, latLngBounds } from 'leaflet';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';

const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const correctIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapInteractiveProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation: { lat: number; lng: number } | null;
  correctLocation?: { lat: number; lng: number } | null;
  showResult: boolean;
  disabled: boolean;
  questionId?: string;
}

const MAP_DEFAULT_VIEW = {
  center: [20, 0] as [number, number],
  zoom: 2,
};

export function shouldFitResultBounds(
  showResult: boolean,
  selectedLocation: { lat: number; lng: number } | null,
  correctLocation?: { lat: number; lng: number } | null
) {
  return Boolean(showResult && selectedLocation && correctLocation);
}

export function shouldResetMapView(showResult: boolean) {
  return !showResult;
}

function ResultViewportController({
  showResult,
  selectedLocation,
  correctLocation,
}: {
  showResult: boolean;
  selectedLocation: { lat: number; lng: number } | null;
  correctLocation?: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!shouldFitResultBounds(showResult, selectedLocation, correctLocation) || !correctLocation) {
      return;
    }

    const bounds = latLngBounds(
      [selectedLocation!.lat, selectedLocation!.lng],
      [correctLocation.lat, correctLocation.lng]
    );

    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 5,
      animate: true,
    });
  }, [showResult, selectedLocation, correctLocation, map]);

  return null;
}

function QuestionViewportController({
  questionId,
  showResult,
}: {
  questionId?: string;
  showResult: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!questionId || !shouldResetMapView(showResult)) {
      return;
    }

    map.setView(MAP_DEFAULT_VIEW.center, MAP_DEFAULT_VIEW.zoom, { animate: false });
  }, [questionId, showResult, map]);

  return null;
}

function LocationMarker({
  onLocationSelect,
  disabled,
}: {
  onLocationSelect: (lat: number, lng: number) => void;
  disabled: boolean;
}) {
  useMapEvents({
    click(e) {
      if (!disabled) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export function MapInteractive({
  onLocationSelect,
  selectedLocation,
  correctLocation,
  showResult,
  disabled,
  questionId,
}: MapInteractiveProps) {
  const { t } = useTranslation();

  const calculateDistance = useCallback(() => {
    if (!selectedLocation || !correctLocation) return null;
    const R = 6371;
    const dLat = ((correctLocation.lat - selectedLocation.lat) * Math.PI) / 180;
    const dLon = ((correctLocation.lng - selectedLocation.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((selectedLocation.lat * Math.PI) / 180) *
        Math.cos((correctLocation.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }, [selectedLocation, correctLocation]);

  const distance = showResult ? calculateDistance() : null;

  return (
    <div className="relative">
      <div className="map-surface overflow-hidden rounded-2xl">
        <MapContainer
          center={MAP_DEFAULT_VIEW.center}
          zoom={MAP_DEFAULT_VIEW.zoom}
          style={{ height: 'clamp(var(--map-height-min), var(--map-height-fluid), var(--map-height-max))', width: '100%' }}
          className="z-0 touch-manipulation"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker onLocationSelect={onLocationSelect} disabled={disabled} />
          <QuestionViewportController questionId={questionId} showResult={showResult} />
          <ResultViewportController
            showResult={showResult}
            selectedLocation={selectedLocation}
            correctLocation={correctLocation}
          />

          {selectedLocation && (
            <Marker
              position={[selectedLocation.lat, selectedLocation.lng]}
              icon={defaultIcon}
            />
          )}

          {showResult && correctLocation && (
            <>
              <Marker
                position={[correctLocation.lat, correctLocation.lng]}
                icon={correctIcon}
              />
              <Circle
                center={[correctLocation.lat, correctLocation.lng]}
                radius={150000}
                pathOptions={{
                  color: 'var(--color-success-500)',
                  fillColor: 'var(--color-success-500)',
                  fillOpacity: 0.2,
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      <div className="mt-2 text-center" aria-live="polite">
        {!selectedLocation && !showResult && (
          <p className="text-sm text-gray-400">{t('game.clickMap')}</p>
        )}
        {selectedLocation && !showResult && (
          <p className="text-sm font-medium text-primary">{t('game.locationSelected')}</p>
        )}
        {showResult && distance !== null && (
          <div className="rounded-2xl border border-gray-700 bg-gray-800/75 px-4 py-4 shadow-sm shadow-black/25">
            <p className="text-[clamp(1.1rem,3.8vw,2rem)] leading-tight text-white">
              {t('game.distance')}: <span className="font-bold text-white">{distance} km</span>
            </p>
            {distance < 50 && (
              <p className="mt-2 text-xl font-medium text-green-400">{t('game.excellent')}</p>
            )}
            {distance >= 50 && distance < 200 && (
              <p className="mt-2 text-xl font-medium text-yellow-400">{t('game.good')}</p>
            )}
            {distance >= 200 && distance < 500 && (
              <p className="mt-2 text-xl font-medium text-orange-400">{t('game.notBad')}</p>
            )}
            {distance >= 500 && (
              <p className="mt-2 text-xl font-medium text-red-400">{t('game.farAway')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
