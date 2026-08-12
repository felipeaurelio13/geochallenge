import { useTranslation } from 'react-i18next';
import type { MasterySummary } from '../../types';

interface LobbyJourneyCardProps {
  summary: MasterySummary | null;
  loading?: boolean;
  onContinue: () => void;
  onPassport: () => void;
}

export function LobbyJourneyCard({
  summary,
  loading,
  onContinue,
  onPassport,
}: LobbyJourneyCardProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <section className="rounded-2xl border border-app-border bg-app-surface p-4">
        <div className="h-16 animate-pulse rounded-lg bg-app-border/30" />
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="rounded-2xl border border-app-border bg-app-surface p-4">
        <h2 className="text-sm font-semibold text-app-text">
          {t('menu.journey.title')}
        </h2>
        <p className="mt-1 text-xs text-app-subtle">
          {t('menu.journey.startDesc', 'Descubre cuánto sabes del planeta.')}
        </p>
        <button
          onClick={onContinue}
          className="mt-3 w-full rounded-lg bg-[var(--color-accent)] py-2 text-sm font-semibold text-white pressable"
        >
          {t('menu.journey.continue')}
        </button>
      </section>
    );
  }

  const totalCountries = summary.totalCountries || 197;
  const coveragePercent =
    totalCountries > 0
      ? (summary.stampedCountries / totalCountries) * 100
      : 0;

  const hasProgress = summary.stampedCountries > 0;

  if (!hasProgress) {
    return (
      <section className="rounded-2xl border border-app-border bg-app-surface p-4 text-center">
        <h2 className="text-sm font-semibold text-app-text">
          {t('menu.journey.startTitle')}
        </h2>
        <p className="mt-1 text-xs text-app-subtle">
          {t('menu.journey.zeroStamps', { total: totalCountries })}
        </p>
        <p className="mt-1 text-xs text-app-subtle">
          {t('menu.journey.startDesc')}
        </p>
        <button
          onClick={onContinue}
          className="mt-3 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white pressable"
        >
          {t('menu.journey.startFirst')}
        </button>
        <button
          onClick={onPassport}
          className="mt-2 ml-3 rounded-lg border border-app-border px-4 py-2 text-xs font-semibold text-app-subtle pressable"
        >
          {t('menu.journey.passport')}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-app-border bg-app-surface p-4">
      <h2 className="text-sm font-semibold text-app-text">
        {t('menu.journey.title')}
      </h2>
      <p className="mt-1 text-xs text-app-subtle">
        {summary.stampedCountries} {t('menu.journey.stamped', { total: totalCountries })}
        {summary.masteredCountries > 0 && (
          <>
            {' · '}
            {summary.masteredCountries} {t('menu.journey.mastered')}
          </>
        )}
      </p>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-app-border/40">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all"
          style={{ width: `${Math.min(coveragePercent, 100)}%` }}
        />
      </div>

      <p className="mt-1.5 text-xs text-app-subtle">
        {t('menu.journey.globalDominance')}: {summary.worldProgressPercent.toFixed(1)}%
      </p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onContinue}
          className="flex-1 rounded-lg bg-[var(--color-accent)] py-2 text-sm font-semibold text-white pressable"
        >
          {t('menu.journey.continue')}
        </button>
        <button
          onClick={onPassport}
          className="rounded-lg border border-app-border px-3 py-2 text-xs font-semibold text-app-subtle pressable"
        >
          {t('menu.journey.passport')}
        </button>
      </div>
    </section>
  );
}
