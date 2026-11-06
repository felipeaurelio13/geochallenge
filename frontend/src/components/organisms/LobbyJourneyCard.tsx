import { useTranslation } from 'react-i18next';
import type { MasterySummary } from '../../types';
import { Button } from '../atoms/Button';

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
      <section className="rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5 shadow-sm">
        <div className="h-20 animate-pulse rounded-xl bg-app-border/30" />
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-app-surface via-app-surface to-primary/5 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-sm" aria-hidden="true">
            🧭
          </span>
          <h2 className="text-sm font-bold text-app-text">
            {t('menu.journey.title')}
          </h2>
        </div>
        <p className="mt-2 text-xs text-app-subtle">
          {t('menu.journey.startDesc')}
        </p>
        <Button
          onClick={onContinue}
          className="mt-3.5 flex items-center justify-center gap-1.5"
          fullWidth
        >
          <span aria-hidden="true">▶</span>
          <span>{t('menu.journey.continue')}</span>
        </Button>
      </section>
    );
  }

  const totalCountries = summary.totalCountries;
  const coveragePercent =
    totalCountries > 0
      ? (summary.stampedCountries / totalCountries) * 100
      : 0;

  const hasProgress = summary.stampedCountries > 0;

  if (!hasProgress) {
    return (
      <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-app-surface via-app-surface to-primary/5 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-sm" aria-hidden="true">
              🧭
            </span>
            <h2 className="text-sm font-bold text-app-text">
              {t('menu.journey.startTitle')}
            </h2>
          </div>
          <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[0.65rem] font-bold text-primary">
            0%
          </span>
        </div>
        <p className="mt-2 text-xs font-semibold text-app-secondary">
          {t('menu.journey.zeroStamps', { total: totalCountries })}
        </p>
        <p className="mt-0.5 text-xs text-app-subtle">
          {t('menu.journey.startDesc')}
        </p>
        <div className="mt-3.5 flex items-center gap-2">
          <Button
            onClick={onContinue}
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            <span aria-hidden="true">▶</span>
            <span>{t('menu.journey.startFirst')}</span>
          </Button>
          <Button
            onClick={onPassport}
            variant="secondary"
            size="sm"
            className="flex items-center gap-1"
          >
            <span aria-hidden="true">📖</span>
            <span>{t('menu.journey.passport')}</span>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-app-surface via-app-surface to-primary/5 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-sm" aria-hidden="true">
            🧭
          </span>
          <h2 className="text-sm font-bold text-app-text">
            {t('menu.journey.title')}
          </h2>
        </div>
        <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[0.65rem] font-bold text-primary">
          {summary.worldProgressPercent.toFixed(1)}% {t('menu.journey.ofWorld', 'del mundo')}
        </span>
      </div>

      <p className="mt-2 text-xs font-medium text-app-secondary">
        {summary.stampedCountries} {t('menu.journey.stamped', { total: totalCountries })}
        {summary.masteredCountries > 0 && (
          <>
            {' · '}
            {summary.masteredCountries} {t('menu.journey.mastered')}
          </>
        )}
      </p>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-app-border/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary-400 transition-all duration-500"
          style={{ width: `${Math.min(coveragePercent, 100)}%` }}
        />
      </div>

      <p className="mt-1.5 text-xs text-app-subtle">
        {t('menu.journey.worldExplored')}: {summary.worldProgressPercent.toFixed(1)}%
      </p>

      <div className="mt-3.5 flex items-center gap-2">
        <Button
          onClick={onContinue}
          className="flex-1 flex items-center justify-center gap-1.5"
        >
          <span aria-hidden="true">▶</span>
          <span>{t('menu.journey.continue')}</span>
        </Button>
        <Button
          onClick={onPassport}
          variant="secondary"
          size="sm"
          className="flex items-center gap-1"
        >
          <span aria-hidden="true">📖</span>
          <span>{t('menu.journey.passport')}</span>
        </Button>
      </div>
    </section>
  );
}
