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
      <section className="border-b border-app-border pb-5">
        <div className="h-16 animate-pulse rounded-lg bg-app-border/30" />
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="border-b border-app-border pb-5">
        <h2 className="text-sm font-semibold text-app-text">
          {t('menu.journey.title')}
        </h2>
        <p className="mt-1 text-xs text-app-subtle">
          {t('menu.journey.startDesc')}
        </p>
        <Button
          onClick={onContinue}
          className="mt-3"
          fullWidth
        >
          {t('menu.journey.continue')}
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
      <section className="border-b border-app-border pb-5">
        <h2 className="text-sm font-semibold text-app-text">
          {t('menu.journey.startTitle')}
        </h2>
        <p className="mt-1 text-xs text-app-subtle">
          {t('menu.journey.zeroStamps', { total: totalCountries })}
        </p>
        <p className="mt-1 text-xs text-app-subtle">
          {t('menu.journey.startDesc')}
        </p>
        <Button
          onClick={onContinue}
          className="mt-3"
        >
          {t('menu.journey.startFirst')}
        </Button>
        <Button
          onClick={onPassport}
          className="mt-2 ml-3"
          variant="secondary"
          size="sm"
        >
          {t('menu.journey.passport')}
        </Button>
      </section>
    );
  }

  return (
    <section className="border-b border-app-border pb-5">
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
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(coveragePercent, 100)}%` }}
        />
      </div>

      <p className="mt-1.5 text-xs text-app-subtle">
        {t('menu.journey.worldExplored')}: {summary.worldProgressPercent.toFixed(1)}%
      </p>

      <div className="mt-3 flex gap-2">
        <Button
          onClick={onContinue}
          className="flex-1"
        >
          {t('menu.journey.continue')}
        </Button>
        <Button
          onClick={onPassport}
          variant="secondary"
          size="sm"
        >
          {t('menu.journey.passport')}
        </Button>
      </div>
    </section>
  );
}
