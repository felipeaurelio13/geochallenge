import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameFilters } from '../../types';
import { CONTINENTS, DIFFICULTIES } from '../../constants/filters';

interface FilterDrawerProps {
  filters: GameFilters;
  onChange: (f: GameFilters) => void;
  onClose: () => void;
  disabledOptions?: {
    continents?: string[];
    difficulties?: string[];
    isInsular?: boolean;
    isLandlocked?: boolean;
  };
}

export function FilterDrawer({ filters, onChange, onClose, disabledOptions }: FilterDrawerProps) {
  const { t } = useTranslation();
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function setContinent(c: string) {
    onChange({ ...filters, continent: filters.continent === c ? undefined : c });
  }

  function setDifficulty(d: GameFilters['difficulty']) {
    onChange({ ...filters, difficulty: filters.difficulty === d ? undefined : d });
  }

  function toggleInsular() {
    onChange({ ...filters, isInsular: filters.isInsular ? undefined : true });
  }

  function toggleLandlocked() {
    onChange({ ...filters, isLandlocked: filters.isLandlocked ? undefined : true });
  }

  function clearAll() {
    onChange({});
  }

  const hasAny =
    !!filters.continent || !!filters.isInsular || !!filters.isLandlocked || !!filters.difficulty;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 rounded-t-2xl border border-gray-700 bg-gray-900 px-4 pb-8 pt-4 shadow-2xl">
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-600" />

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">{t('filters.title')}</h2>
          {hasAny && (
            <button
              onClick={clearAll}
              className="text-xs font-medium text-red-400 hover:text-red-300"
            >
              {t('filters.clearAll')}
            </button>
          )}
        </div>

        {/* Continent */}
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            {t('filters.region')}
          </p>
          <div className="flex flex-wrap gap-2">
            {CONTINENTS.map((c) => (
              <button
                key={c.id}
                onClick={() => setContinent(c.id)}
                disabled={disabledOptions?.continents?.includes(c.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  filters.continent === c.id
                    ? 'border-primary/70 bg-primary/20 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
                }`}
              >
                <span>{c.icon}</span>
                <span>{t(`filters.continents.${c.id.replace(' ', '_')}`)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Geographic type */}
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            {t('filters.geoType')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={toggleInsular}
              disabled={disabledOptions?.isInsular}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                filters.isInsular
                  ? 'border-primary/70 bg-primary/20 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
              }`}
            >
              <span>🏝️</span>
              <span>{t('filters.insular')}</span>
            </button>
            <button
              onClick={toggleLandlocked}
              disabled={disabledOptions?.isLandlocked}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                filters.isLandlocked
                  ? 'border-primary/70 bg-primary/20 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
              }`}
            >
              <span>🔒</span>
              <span>{t('filters.landlocked')}</span>
            </button>
          </div>
        </div>

        {/* Difficulty */}
        <div className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            {t('filters.difficulty')}
          </p>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                disabled={disabledOptions?.difficulties?.includes(d.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  filters.difficulty === d.id
                    ? 'border-primary/70 bg-primary/20 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
                }`}
              >
                <span>{d.icon}</span>
                <span>{t(`filters.difficulties.${d.id}`)}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75"
        >
          {t('filters.apply')}
        </button>
      </div>
    </div>
  );
}
