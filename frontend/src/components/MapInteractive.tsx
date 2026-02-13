import { useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Circle } from 'react-leaflet';
import { Icon } from 'leaflet';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon
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
}: MapInteractiveProps) {
  const { t } = useTranslation();

  // Calculate distance between two points
  const calculateDistance = useCallback(() => {
    if (!selectedLocation || !correctLocation) return null;
    const R = 6371; // Earth's radius in km
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
      <div className="rounded-xl overflow-hidden border-2 border-gray-700">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: 'clamp(250px, 50vh, 400px)', width: '100%' }}
          className="z-0 touch-manipulation"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker onLocationSelect={onLocationSelect} disabled={disabled} />

          {/* User's selected location */}
          {selectedLocation && (
            <Marker
              position={[selectedLocation.lat, selectedLocation.lng]}
              icon={defaultIcon}
            />
          )}

          {/* Correct location (shown after answer) */}
          {showResult && correctLocation && (
            <>
              <Marker
                position={[correctLocation.lat, correctLocation.lng]}
                icon={correctIcon}
              />
              <Circle
                center={[correctLocation.lat, correctLocation.lng]}
                radius={50000}
                pathOptions={{
                  color: '#22c55e',
                  fillColor: '#22c55e',
                  fillOpacity: 0.2,
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* Instructions or result */}
      <div className="mt-4 text-center">
        {!selectedLocation && !showResult && (
          <p className="text-gray-400">{t('game.clickMap')}</p>
        )}
        {selectedLocation && !showResult && (
          <p className="text-primary">{t('game.locationSelected')}</p>
        )}
        {showResult && distance !== null && (
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-lg">
              {t('game.distance')}: <span className="font-bold text-primary">{distance} km</span>
            </p>
            {distance < 50 && (
              <p className="text-green-400 mt-1">{t('game.excellent')}</p>
            )}
            {distance >= 50 && distance < 200 && (
              <p className="text-yellow-400 mt-1">{t('game.good')}</p>
            )}
            {distance >= 200 && distance < 500 && (
              <p className="text-orange-400 mt-1">{t('game.notBad')}</p>
            )}
            {distance >= 500 && (
              <p className="text-red-400 mt-1">{t('game.farAway')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
