import { useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Circle, useMap } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { DivIcon, latLngBounds } from 'leaflet';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';

/** How far (in screen pixels) one arrow-key press pans the map. */
const KEYBOARD_PAN_STEP_PX = 80;

function pinSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41"><path fill="${color}" stroke="white" stroke-width="1.5" d="M12.5 1C7.25 1 3 5.35 3 10.7C3 18.2 12.5 40 12.5 40C12.5 40 22 18.2 22 10.7C22 5.35 17.75 1 12.5 1Z"/><circle cx="12.5" cy="10.5" r="4" fill="white"/></svg>`;
}

const ICON_BASE = {
  className: '',
  iconSize: [25, 41] as [number, number],
  iconAnchor: [12, 41] as [number, number],
};

const defaultIcon = new DivIcon({ ...ICON_BASE, html: pinSvg('#2563EB') });
const correctIcon = new DivIcon({ ...ICON_BASE, html: pinSvg('#16a34a') });

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

    const userLng = selectedLocation!.lng;
    let correctLng = correctLocation.lng;
    const lngDiff = correctLng - userLng;
    if (lngDiff > 180) correctLng -= 360;
    else if (lngDiff < -180) correctLng += 360;

    const bounds = latLngBounds(
      [selectedLocation!.lat, userLng],
      [correctLocation.lat, correctLng]
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

/**
 * Captures the Leaflet map instance into a ref supplied by the parent so
 * keyboard handlers (attached outside the react-leaflet tree, on the
 * focusable wrapper div) can drive the map imperatively — pan, zoom, and
 * read the current center to place a marker "at center" for Enter/Space.
 */
function MapInstanceCapture({ mapRef }: { mapRef: React.MutableRefObject<LeafletMap | null> }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
    return () => {
      if (mapRef.current === map) {
        mapRef.current = null;
      }
    };
  }, [map, mapRef]);

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
  const mapRef = useRef<LeafletMap | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const map = mapRef.current;
      if (!map || disabled) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          map.panBy([0, -KEYBOARD_PAN_STEP_PX]);
          break;
        case 'ArrowDown':
          e.preventDefault();
          map.panBy([0, KEYBOARD_PAN_STEP_PX]);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          map.panBy([-KEYBOARD_PAN_STEP_PX, 0]);
          break;
        case 'ArrowRight':
          e.preventDefault();
          map.panBy([KEYBOARD_PAN_STEP_PX, 0]);
          break;
        case '+':
        case '=':
          e.preventDefault();
          map.zoomIn();
          break;
        case '-':
          e.preventDefault();
          map.zoomOut();
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!showResult) {
            const center = map.getCenter();
            onLocationSelect(center.lat, center.lng);
          }
          break;
        default:
          break;
      }
    },
    [disabled, onLocationSelect, showResult]
  );

  return (
    // El wrapper toma toda la altura disponible del flex parent en
    // GameRoundScaffold. Antes la map-surface tenía clamp con max ~19rem
    // (304px), dejando ~250px de espacio muerto debajo en iPhone 14 (QA round
    // 3 design audit). Ahora el mapa fluye: min razonable, max = 100% del flex
    // container disponible.
    <div className="relative flex h-full min-h-0 flex-col">
      <p id="map-keyboard-instructions" className="sr-only">
        {t('map.keyboardInstructions')}
      </p>
      {/*
        role="application" is the standard ARIA pattern for an interactive map
        widget with its own keyboard model (arrow keys pan instead of scrolling
        the page) — jsx-a11y's default interactive-role allowlist doesn't
        include it, hence the disable block below.
      */}
      {/* eslint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="map-surface relative flex-1 min-h-[12.5rem] overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        tabIndex={0}
        role="application"
        aria-label={t('map.keyboardInstructions')}
        aria-describedby="map-keyboard-instructions"
        onKeyDown={handleKeyDown}
      >
        {/* eslint-enable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */}
        <MapContainer
          center={MAP_DEFAULT_VIEW.center}
          zoom={MAP_DEFAULT_VIEW.zoom}
          style={{ height: '100%', width: '100%' }}
          className="z-0 touch-manipulation"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
          />
          <LocationMarker onLocationSelect={onLocationSelect} disabled={disabled} />
          <QuestionViewportController questionId={questionId} showResult={showResult} />
          <ResultViewportController
            showResult={showResult}
            selectedLocation={selectedLocation}
            correctLocation={correctLocation}
          />
          <MapInstanceCapture mapRef={mapRef} />

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

        {/* Subtle crosshair at the exact viewport center — useful for every
            user as a "here's where Enter/Space will drop the pin" reference,
            not just keyboard users (common map-picker UX). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-1/2"
        >
          <div className="relative h-5 w-5">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/70 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/70 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
          </div>
        </div>
      </div>

      <div className="mt-2 text-center" aria-live="polite">
        {!selectedLocation && !showResult && (
          <p className="text-sm text-gray-400">{t('game.clickMap')}</p>
        )}
        {selectedLocation && !showResult && (
          <p className="text-sm font-medium text-primary">{t('game.locationSelected')}</p>
        )}
        {showResult && distance !== null && (
          <div className="rounded-2xl border border-app-border bg-app-muted/75 px-4 py-4 shadow-sm shadow-black/25">
            <p className="text-[clamp(1.1rem,3.8vw,2rem)] leading-tight text-app-text">
              {t('game.distance')}: <span className="font-bold text-app-text">{distance} km</span>
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
