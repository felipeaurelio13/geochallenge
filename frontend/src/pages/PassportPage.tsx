import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import type { PassportResponse, CountryMastery, SkillMastery, MasteryLevel } from '../types';
import { Button, GeoIcon, LoadingSpinner } from '../components';
import { FullScreenError } from '../components/molecules/FullScreenError';
import { EmptyState } from '../components/molecules/EmptyState';
import { GeoMark } from '../components/atoms/GeoMark';
import { getLocalizedCountryName } from '../utils/countryNames';

const LEVEL_LABELS: Record<MasteryLevel, string> = {
  UNSEEN: 'No jugado',
  LEARNING: 'Aprendiendo',
  FAMILIAR: 'Conocido',
  STRONG: 'Fuerte',
  MASTERED: 'Dominado',
};

const LEVEL_COLORS: Record<MasteryLevel, string> = {
  UNSEEN: 'text-[var(--color-text-muted)]',
  LEARNING: 'text-[var(--color-text-secondary)]',
  FAMILIAR: 'text-primary',
  STRONG: 'text-primary',
  MASTERED: 'text-success-500',
};

export function PassportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<PassportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [continentFilter, setContinentFilter] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getPassport();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Error al cargar el pasaporte');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <FullScreenError
        title={t('common.error')}
        message={error}
        onRetry={fetchData}
        retryLabel={t('common.retry')}
        backTo="/menu"
        backLabel={t('common.back')}
      />
    );
  }

  if (!data) return null;

  const { summary, countries } = data;
  const continents = [...new Set(countries.map((c) => c.continent))].sort();
  const filtered = continentFilter
    ? countries.filter((c) => c.continent === continentFilter)
    : countries;

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-bg-app)] px-4 py-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-2xl font-bold text-[var(--color-text-primary)]">
          {t('passport.title', 'Mi viaje')}
        </h1>

        <section className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-[var(--color-accent)]">
                {summary.worldProgressPercent}%
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {t('passport.worldProgress', 'del mundo')}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {summary.stampedCountries}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {t('passport.stamped', 'países sellados')}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {summary.totalCountries}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {t('passport.totalCountries', 'países')}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-success-500">
                {summary.masteredCountries}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {t('passport.mastered', 'dominados')}
              </div>
            </div>
          </div>
        </section>

        {summary.stampedCountries === 0 ? (
          <EmptyState message={t('passport.empty', 'Juega partidas para empezar a llenar tu pasaporte')} />
        ) : (
          <>
            {continents.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setContinentFilter(null)}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    !continentFilter
                      ? 'border-primary bg-primary text-white'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  {t('common.all')}
                </button>
                {continents.map((cont) => (
                  <button
                    key={cont}
                    onClick={() => setContinentFilter(cont)}
                    className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                      continentFilter === cont
                        ? 'border-primary bg-primary text-white'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {cont}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {filtered.map((country) => (
                <CountryCard
                  key={country.countryCode}
                  country={country}
                  expanded={expandedCountry === country.countryCode}
                  onToggle={() =>
                    setExpandedCountry(
                      expandedCountry === country.countryCode ? null : country.countryCode
                    )
                  }
                  onPractice={() =>
                    navigate(`/game/single?gameType=practice&countryCode=${country.countryCode}`)
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CountryCard({
  country,
  expanded,
  onToggle,
  onPractice,
}: {
  country: CountryMastery;
  expanded: boolean;
  onToggle: () => void;
  onPractice: () => void;
}) {
  const { t, i18n } = useTranslation();
  const flag = getCountryEmoji(country.countryCode);
  const countryName = getLocalizedCountryName(country.countryCode, i18n.language, country.name);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {flag ? (
          <span className="text-xl" role="img" aria-label={countryName}>{flag}</span>
        ) : (
          <GeoMark className="h-5 w-5 shrink-0 text-primary" title={countryName} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {countryName}
            </span>
            {country.stamped && (
              <span className="shrink-0 text-success-500" title={t('passport.stamped', 'Sellado')}>
                <span className="sr-only">{t('passport.stamped', 'Sellado')}</span>
                <GeoIcon name="challenge" size={14} />
              </span>
            )}
            {country.mastered && (
              <span className="shrink-0 text-primary" title={t('passport.masteredLabel', 'Dominado')}>
                <span className="sr-only">{t('passport.masteredLabel', 'Dominado')}</span>
                <GeoIcon name="rank" size={14} />
              </span>
            )}
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">
            {country.score}%
          </span>
        </div>
        <span className="text-xs text-[var(--color-text-muted)] shrink-0" aria-hidden="true">
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <div className="mb-3 flex flex-col gap-1.5">
            {country.skills.map((skill) => (
              <SkillRow key={skill.category} skill={skill} />
            ))}
          </div>
          <Button
            onClick={onPractice}
            fullWidth
          >
            {t('passport.practiceCountry', 'Practicar {{country}}', { country: countryName })}
          </Button>
        </div>
      )}
    </div>
  );
}

function SkillRow({ skill }: { skill: SkillMastery }) {
  const { t } = useTranslation();
  const categoryLabels: Record<string, string> = {
    FLAG: t('categories.flag', 'Banderas'),
    CAPITAL: t('categories.capital', 'Capitales'),
    MAP: t('categories.map', 'Mapas'),
    SILHOUETTE: t('categories.silhouette', 'Siluetas'),
    MONUMENT: t('categories.monument', 'Monumentos'),
  };

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--color-text-secondary)]">
        {categoryLabels[skill.category] ?? skill.category}
      </span>
      <span className={`${LEVEL_COLORS[skill.level]} font-medium`}>
        {t(`mastery.level.${skill.level.toLowerCase()}`, LEVEL_LABELS[skill.level])}
      </span>
    </div>
  );
}

const COUNTRY_EMOJI_MAP: Record<string, string> = {
  CL: '🇨🇱', AR: '🇦🇷', BR: '🇧🇷', PE: '🇵🇪', CO: '🇨🇴', MX: '🇲🇽',
  US: '🇺🇸', CA: '🇨🇦', GB: '🇬🇧', FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹',
  ES: '🇪🇸', PT: '🇵🇹', JP: '🇯🇵', CN: '🇨🇳', KR: '🇰🇷', IN: '🇮🇳',
  AU: '🇦🇺', NZ: '🇳🇿', RU: '🇷🇺', ZA: '🇿🇦', EG: '🇪🇬', NG: '🇳🇬',
  KE: '🇰🇪', MA: '🇲🇦', SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮',
  NL: '🇳🇱', BE: '🇧🇪', CH: '🇨🇭', AT: '🇦🇹', PL: '🇵🇱', UA: '🇺🇦',
  GR: '🇬🇷', TR: '🇹🇷', IL: '🇮🇱', SA: '🇸🇦', AE: '🇦🇪', TH: '🇹🇭',
  VN: '🇻🇳', ID: '🇮🇩', PH: '🇵🇭', SG: '🇸🇬', MY: '🇲🇾', IE: '🇮🇪',
  CZ: '🇨🇿', HU: '🇭🇺', RO: '🇷🇴', BG: '🇧🇬', HR: '🇭🇷', SK: '🇸🇰',
};

function getCountryEmoji(countryCode: string): string {
  if (COUNTRY_EMOJI_MAP[countryCode]) return COUNTRY_EMOJI_MAP[countryCode];
  const upper = countryCode.toUpperCase();
  if (upper.length === 2) {
    const a = 0x1F1E6 + upper.charCodeAt(0) - 65;
    const b = 0x1F1E6 + upper.charCodeAt(1) - 65;
    return String.fromCodePoint(a, b);
  }
  return '';
}
