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

const categories: { id: Category; icon: string; labelKey: string; accentClass: string }[] = [
  { id: 'FLAG', icon: '🏳️', labelKey: 'categories.flags', accentClass: 'border-blue-500/50 bg-blue-500/15 text-blue-400' },
  { id: 'CAPITAL', icon: '🏛️', labelKey: 'categories.capitals', accentClass: 'border-green-500/50 bg-green-500/15 text-green-400' },
  { id: 'MAP', icon: '🗺️', labelKey: 'categories.maps', accentClass: 'border-teal-500/50 bg-teal-500/15 text-teal-400' },
  { id: 'SILHOUETTE', icon: '🖼️', labelKey: 'categories.silhouettes', accentClass: 'border-violet-500/50 bg-violet-500/15 text-violet-400' },
  { id: 'MONUMENT', icon: '🗿', labelKey: 'categories.monuments', accentClass: 'border-amber-500/50 bg-amber-500/15 text-amber-400' },
  { id: 'CINEMA_GEO', icon: '🎬', labelKey: 'categories.cinemaGeo', accentClass: 'border-rose-500/50 bg-rose-500/15 text-rose-400' },
  { id: 'MIXED', icon: '🎲', labelKey: 'categories.mixed', accentClass: 'border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-400' },
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

  const filterButtonLabel = filtersActive
    ? t('filters.openActiveFilters', { summary: filterSummary(filters, t) })
    : t('filters.openFilters');

  const mapDisabled = selectedCategory === 'MAP';

  return (
    <section
      className="rounded-2xl border border-app-border bg-app-surface p-4"
      aria-label={isPractice ? t('menu.practice.title') : t('menu.compete.title')}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-app-text">
          {isPractice ? t('menu.practice.title') : t('menu.compete.title')}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-app-subtle hover:text-app-text pressable"
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
            icon: cat.icon,
            label: t(cat.labelKey),
            accentClass: cat.accentClass,
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
            className="rounded-full border border-app-border bg-app-surface/80 px-2 py-1.5 text-xs text-app-subtle hover:text-red-400"
            title={t('filters.clearActive')}
            aria-label={t('filters.clearActive')}
          >
            ✕
          </button>
        )}
      </div>

      {!availability?.canPlay && availability?.available != null && (
        <p className="mt-2 text-xs text-amber-300">
          {t('filters.unavailableCombination', {
            required: availability.required,
            available: availability.available,
          })}
        </p>
      )}

      {/* Format buttons */}
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-app-secondary">
          {isPractice ? t('menu.practice.formats') : ''}
        </p>

        {isPractice ? (
          <div className="space-y-2">
            {onPlayClassic && (
              <ModeButtonWithHelp
                icon="🎯"
                title={t('menu.practice.classic')}
                desc={t('menu.practice.classicDesc')}
                onClick={onPlayClassic}
                onOpenHelp={() => onOpenHelp('single')}
                helpAriaLabel={t('menu.howToPlayAria', { mode: t('menu.singlePlayer') })}
              />
            )}
            {onPlayFlash && (
              <ModeButtonWithHelp
                icon="⚡"
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
                icon="🔥"
                title={t('menu.practice.streak')}
                desc={t('menu.practice.streakDesc')}
                onClick={onPlayStreak}
                onOpenHelp={() => onOpenHelp('streak')}
                helpAriaLabel={t('menu.howToPlayAria', { mode: t('menu.streak') })}
              />
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {onCompetitionHub && (
              <SpecialButton
                icon="🏆"
                title={t('menu.compete.competitionHub')}
                desc={t('menu.compete.competitionHubDesc')}
                onClick={onCompetitionHub}
              />
            )}
            {onPlayDuel && (
              <ModeButtonWithHelp
                icon="⚔️"
                title={t('menu.compete.duel')}
                desc={t('menu.compete.duelDesc')}
                onClick={onPlayDuel}
                onOpenHelp={() => onOpenHelp('duel')}
                helpAriaLabel={t('menu.howToPlayAria', { mode: t('menu.duel') })}
              />
            )}
            {onPlayChallenge && (
              <ModeButtonWithHelp
                icon="🏁"
                title={t('menu.compete.challenge')}
                desc={t('menu.compete.challengeDesc')}
                onClick={onPlayChallenge}
                onOpenHelp={() => onOpenHelp('challenge')}
                helpAriaLabel={t('menu.howToPlayAria', { mode: t('menu.challenge') })}
              />
            )}
            {onPlaySurvival && (
              <ModeButtonWithHelp
                icon="☠️"
                title={t('menu.compete.survival')}
                desc={t('menu.compete.survivalDesc')}
                onClick={onPlaySurvival}
                onOpenHelp={() => onOpenHelp('survival')}
                helpAriaLabel={t('menu.howToPlayAria', { mode: t('menu.survival') })}
              />
            )}
          </div>
        )}
      </div>

      {/* Special challenges */}
      <div className="mt-4 space-y-2">
        {isPractice ? (
          <>
            {onFlagMaster && (
              <SpecialButton
                icon="🏴"
                title={t('menu.special.flagMaster')}
                desc={t('menu.special.flagMasterDesc')}
                onClick={onFlagMaster}
              />
            )}
            {onGeoChallenges && (
              <SpecialButton
                icon="🧠"
                title={t('menu.special.geoChallenges')}
                desc={t('menu.special.geoChallengesDesc')}
                onClick={onGeoChallenges}
              />
            )}
          </>
        ) : (
          <>
            {onGeoChallengesDuel && (
              <SpecialButton
                icon="🧠⚔️"
                title={t('menu.special.geoChallengesDuel')}
                desc={t('menu.special.geoChallengesDuelDesc')}
                onClick={onGeoChallengesDuel}
              />
            )}
          </>
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
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-primary/60 bg-primary/15 text-primary'
          : 'border-app-border bg-app-surface/80 text-app-subtle hover:border-app-border hover:text-app-secondary'
      }`}
    >
      <span aria-hidden="true">🎚️</span>
      <span>{label}</span>
      {!active && <span aria-hidden="true" className="opacity-50">▾</span>}
    </button>
  );
}

function ModeButtonWithHelp({
  icon,
  title,
  desc,
  onClick,
  disabled,
  disabledHint,
  onOpenHelp,
  helpAriaLabel,
}: {
  icon: string;
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
      <div className="relative rounded-xl border border-app-border/50 bg-app-surface/40 px-4 py-3 opacity-60">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-xl leading-none">{icon}</span>
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
        className="w-full rounded-xl border border-app-border bg-app-surface/80 px-4 py-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/10 pressable"
      >
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-xl leading-none">{icon}</span>
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
        className="pressable absolute right-1 top-1 flex min-h-7 min-w-7 items-center justify-center rounded-full border border-app-border bg-app-surface/90 text-xs font-bold text-app-subtle shadow-sm transition-colors hover:border-primary/60 hover:text-primary"
      >
        ?
      </button>
    </div>
  );
}

function SpecialButton({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-3 text-left transition-colors hover:bg-fuchsia-500/20 pressable"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-xl leading-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-fuchsia-200">{title}</div>
          <div className="text-xs text-fuchsia-300/80">{desc}</div>
        </div>
        <span aria-hidden="true" className="text-fuchsia-300/80">→</span>
      </div>
    </button>
  );
}
