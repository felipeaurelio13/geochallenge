import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CategorySelector } from '../molecules/CategorySelector';
import { hasActiveFilters, type Category, type GameFilters } from '../../types';

type PanelType = 'practice' | 'compete';

interface AvailabilityInfo {
  canPlay: boolean;
  required: number;
  available: number | null;
}

interface LobbyModePanelProps {
  type: PanelType;
  selectedCategory: Category;
  onSelectCategory: (id: Category) => void;
  filters: GameFilters;
  onClearFilters: () => void;
  onOpenFilters: () => void;
  availability: AvailabilityInfo | null;
  onPlayClassic?: () => void;
  onPlayFlash?: () => void;
  onPlayStreak?: () => void;
  onOpenHelp: (mode: string) => void;
  // Compete-only
  onPlayDuel?: () => void;
  onPlayChallenge?: () => void;
  onPlaySurvival?: () => void;
  onCompetitionHub?: () => void;
  // Special
  onFlagMaster?: () => void;
  onGeoChallenges?: () => void;
  onGeoChallengesDuel?: () => void;
  onClose: () => void;
}

const categories: { id: Category; labelKey: string }[] = [
  { id: 'FLAG', labelKey: 'categories.flags' },
  { id: 'CAPITAL', labelKey: 'categories.capitals' },
  { id: 'MAP', labelKey: 'categories.maps' },
  { id: 'SILHOUETTE', labelKey: 'categories.silhouettes' },
  { id: 'MONUMENT', labelKey: 'categories.monuments' },
  { id: 'MIXED', labelKey: 'categories.mixed' },
];

export function LobbyModePanel({
  type,
  selectedCategory,
  onSelectCategory,
  filters,
  onClearFilters,
  onOpenFilters,
  availability,
  onPlayClassic,
  onPlayFlash,
  onPlayStreak,
  onOpenHelp,
  onPlayDuel,
  onPlayChallenge,
  onPlaySurvival,
  onCompetitionHub,
  onFlagMaster,
  onGeoChallenges,
  onGeoChallengesDuel,
  onClose,
}: LobbyModePanelProps) {
  const { t } = useTranslation();
  const isPractice = type === 'practice';
  const filtersActive = hasActiveFilters(filters);
  const [showMore, setShowMore] = useState(false);

  const filterButtonLabel = filtersActive
    ? t('filters.openActiveFilters', { summary: filterSummary(filters, t) })
    : t('filters.openFilters');

  const mapDisabled = selectedCategory === 'MAP';

  return (
    <section
      className="border-t border-app-border bg-app-surface px-0 py-4"
      aria-label={isPractice ? t('menu.practice.title') : t('menu.compete.title')}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-app-text">
          {isPractice ? t('menu.practice.title') : t('menu.compete.title')}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-app-subtle hover:bg-app-muted hover:text-app-text pressable"
          aria-label={t('common.close')}
        >
          ✕
        </button>
      </div>

      <p className="mt-1 text-xs text-app-subtle">
        {isPractice ? t('menu.practice.subtitle') : t('menu.compete.subtitle')}
      </p>

      {/* Category selector */}
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-app-secondary">
          {isPractice ? t('menu.practice.categories') : t('menu.compete.category')}
        </p>
        <CategorySelector
          categories={categories.map((cat) => ({
            id: cat.id,
            label: t(cat.labelKey),
          }))}
          selected={selectedCategory}
          onSelect={(id) => onSelectCategory(id as Category)}
          ariaLabel={t('menu.categorySelectorLabel')}
        />
      </div>

      {/* Filter bar */}
      <div className="mt-2 flex items-center gap-2">
        <FilterButton
          label={filterButtonLabel}
          active={filtersActive}
          onClick={onOpenFilters}
        />
        {filtersActive && (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-md border border-app-border bg-app-surface px-2 py-1.5 text-xs text-app-subtle hover:text-error-500"
            title={t('filters.clearActive')}
            aria-label={t('filters.clearActive')}
          >
            ✕
          </button>
        )}
      </div>

      {!availability?.canPlay && availability?.available != null && (
        <p className="mt-2 text-xs text-warning-500">
          {t('filters.unavailableCombination', {
            required: availability.required,
            available: availability.available,
          })}
        </p>
      )}

      {/* Primary formats */}
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-app-secondary">
          {isPractice ? t('menu.practice.formats') : ''}
        </p>

        {isPractice ? (
          <div className="space-y-2">
            {onPlayClassic && (
              <ModeButtonWithHelp
                title={t('menu.practice.classic')}
                desc={t('menu.practice.classicDesc')}
                onClick={onPlayClassic}
                onOpenHelp={() => onOpenHelp('single')}
                helpAriaLabel={t('menu.howToPlayAria', { mode: t('menu.singlePlayer') })}
              />
            )}
            {onGeoChallenges && (
              <SpecialButton
                title={t('menu.special.geoChallenges')}
                desc={t('menu.special.geoChallengesDesc')}
                onClick={onGeoChallenges}
              />
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {onCompetitionHub && (
              <SpecialButton
                title={t('menu.compete.competitionHub')}
                desc={t('menu.compete.competitionHubDesc')}
                onClick={onCompetitionHub}
              />
            )}
            {onPlayChallenge && (
              <ModeButtonWithHelp
                title={t('menu.compete.challenge')}
                desc={t('menu.compete.challengeDesc')}
                onClick={onPlayChallenge}
                onOpenHelp={() => onOpenHelp('challenge')}
                helpAriaLabel={t('menu.howToPlayAria', { mode: t('menu.challenge') })}
              />
            )}
          </div>
        )}
      </div>

      {/* Collapsed extra formats */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="flex w-full items-center justify-between rounded-lg border border-app-border/50 bg-app-surface/40 px-3 py-2 text-left text-xs font-semibold text-app-subtle transition-colors hover:border-app-border hover:text-app-secondary pressable"
        >
          <span>
            {isPractice ? t('menu.practice.moreTitle') : t('menu.compete.moreTitle')}
          </span>
          <span aria-hidden="true" className="text-app-subtle">{showMore ? '▾' : '▸'}</span>
        </button>

        {showMore && (
          <div className="mt-2 space-y-2">
            {isPractice ? (
              <>
                {onPlayFlash && (
                  <ModeButtonWithHelp
                    title={t('menu.practice.flash')}
                    desc={t('menu.practice.flashDesc')}
                    onClick={onPlayFlash}
                    disabled={mapDisabled}
                    disabledHint={mapDisabled ? t('menu.practice.flashDisabledMap') : undefined}
                    onOpenHelp={() => onOpenHelp('flash')}
                    helpAriaLabel={t('menu.howToPlayAria', { mode: t('menu.flash') })}
                  />
                )}
                {onPlayStreak && (
                  <ModeButtonWithHelp
                    title={t('menu.practice.streak')}
                    desc={t('menu.practice.streakDesc')}
                    onClick={onPlayStreak}
                    onOpenHelp={() => onOpenHelp('streak')}
                    helpAriaLabel={t('menu.howToPlayAria', { mode: t('menu.streak') })}
                  />
                )}
                {onFlagMaster && (
                  <SpecialButton
                    title={t('menu.special.flagMaster')}
                    desc={t('menu.special.flagMasterDesc')}
                    onClick={onFlagMaster}
                  />
                )}
              </>
            ) : (
              <>
                {onPlayDuel && (
                  <ModeButtonWithHelp
                    title={t('menu.compete.duel')}
                    desc={t('menu.compete.duelDesc')}
                    onClick={onPlayDuel}
                    onOpenHelp={() => onOpenHelp('duel')}
                    helpAriaLabel={t('menu.howToPlayAria', { mode: t('menu.duel') })}
                  />
                )}
                {onPlaySurvival && (
                  <ModeButtonWithHelp
                    title={t('menu.compete.survival')}
                    desc={t('menu.compete.survivalDesc')}
                    onClick={onPlaySurvival}
                    onOpenHelp={() => onOpenHelp('survival')}
                    helpAriaLabel={t('menu.howToPlayAria', { mode: t('menu.survival') })}
                  />
                )}
                {onGeoChallengesDuel && (
                  <SpecialButton
                    title={t('menu.special.geoChallengesDuel')}
                    desc={t('menu.special.geoChallengesDuelDesc')}
                    onClick={onGeoChallengesDuel}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function filterSummary(f: GameFilters, t: (key: string) => string): string {
  const parts: string[] = [];
  if (f.continent) parts.push(t(`filters.continents.${f.continent.replace(' ', '_')}`));
  if (f.isInsular) parts.push(t('filters.insular'));
  if (f.isLandlocked) parts.push(t('filters.landlocked'));
  if (f.difficulty) parts.push(t(`filters.difficulties.${f.difficulty}`));
  return parts.join(' · ');
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-haspopup="dialog"
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-primary/60 bg-primary/15 text-primary'
          : 'border-app-border bg-app-surface/80 text-app-subtle hover:border-app-border hover:text-app-secondary'
      }`}
    >
      <span>{label}</span>
      {!active && <span aria-hidden="true" className="opacity-50">▾</span>}
    </button>
  );
}

function ModeButtonWithHelp({
  title,
  desc,
  onClick,
  disabled,
  disabledHint,
  onOpenHelp,
  helpAriaLabel,
}: {
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
  onOpenHelp: () => void;
  helpAriaLabel: string;
}) {
  if (disabled) {
    return (
      <div className="relative rounded-md border border-app-border bg-app-muted px-4 py-3 opacity-60">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-app-text">{title}</div>
            <div className="text-xs text-app-subtle">{desc}</div>
          </div>
        </div>
        {disabledHint && (
          <p className="mt-1 text-[0.65rem] text-amber-300/80">{disabledHint}</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-md border border-app-border bg-app-surface px-4 py-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/10 pressable"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-app-text">{title}</div>
            <div className="text-xs text-app-subtle">{desc}</div>
          </div>
          <span aria-hidden="true" className="text-app-subtle">→</span>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenHelp();
        }}
        aria-label={helpAriaLabel}
        className="pressable absolute right-1 top-1 flex min-h-8 min-w-8 items-center justify-center rounded-md border border-app-border bg-app-surface text-xs font-bold text-app-subtle transition-colors hover:border-primary/60 hover:text-primary"
      >
        ?
      </button>
    </div>
  );
}

function SpecialButton({
  title,
  desc,
  onClick,
}: {
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border border-app-border bg-app-surface px-4 py-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/10 pressable"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-app-text">{title}</div>
          <div className="text-xs text-app-subtle">{desc}</div>
        </div>
        <span aria-hidden="true" className="text-app-subtle">→</span>
      </div>
    </button>
  );
}
