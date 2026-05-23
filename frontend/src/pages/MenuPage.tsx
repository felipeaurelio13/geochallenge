import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from '../hooks';
import { useGameFilters } from '../hooks/useGameFilters';
import { Button, Header, Icon, PageTemplate, SectionTitle } from '../components';
import { UserAvatar } from '../components/atoms/UserAvatar';
import { CategorySelector } from '../components/molecules/CategorySelector';
import { GameModeCard } from '../components/molecules/GameModeCard';
import { FilterDrawer } from '../components/molecules/FilterDrawer';
import { hasActiveFilters, filtersToParams, type Difficulty, type GameFilters } from '../types';
import { api } from '../services/api';
import { CONTINENT_IDS, DIFFICULTY_IDS } from '../constants/filters';

type Category = 'FLAG' | 'CAPITAL' | 'MAP' | 'SILHOUETTE' | 'MONUMENT' | 'MOVIE_SCENE' | 'MIXED';

const categories: { id: Category; icon: string; labelKey: string; accentClass: string }[] = [
  { id: 'FLAG', icon: '🏳️', labelKey: 'categories.flags', accentClass: 'border-blue-500/50 bg-blue-500/15 text-blue-400' },
  { id: 'CAPITAL', icon: '🏛️', labelKey: 'categories.capitals', accentClass: 'border-green-500/50 bg-green-500/15 text-green-400' },
  { id: 'MAP', icon: '🗺️', labelKey: 'categories.maps', accentClass: 'border-teal-500/50 bg-teal-500/15 text-teal-400' },
  { id: 'SILHOUETTE', icon: '🖼️', labelKey: 'categories.silhouettes', accentClass: 'border-violet-500/50 bg-violet-500/15 text-violet-400' },
  { id: 'MONUMENT', icon: '🗿', labelKey: 'categories.monuments', accentClass: 'border-amber-500/50 bg-amber-500/15 text-amber-400' },
  { id: 'MOVIE_SCENE', icon: '🎬', labelKey: 'categories.movieScenes', accentClass: 'border-rose-500/50 bg-rose-500/15 text-rose-400' },
  { id: 'MIXED', icon: '🎲', labelKey: 'categories.mixed', accentClass: 'border-slate-400/50 bg-slate-400/15 text-slate-300' },
];

const GAME_MODE_ACCENTS = {
  flash: {
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    hover: 'hover:border-amber-500/45 hover:bg-amber-500/10',
  },
  single: {
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    hover: 'hover:border-blue-500/45 hover:bg-blue-500/10',
  },
  duel: {
    border: 'border-orange-500/30',
    icon: 'text-orange-400',
    hover: 'hover:border-orange-500/45 hover:bg-orange-500/10',
  },
  challenge: {
    border: 'border-violet-500/30',
    icon: 'text-violet-400',
    hover: 'hover:border-violet-500/45 hover:bg-violet-500/10',
  },
  streak: {
    border: 'border-orange-600/30',
    icon: 'text-orange-500',
    hover: 'hover:border-orange-600/45 hover:bg-orange-600/10',
  },
  survival: {
    border: 'border-rose-600/30',
    icon: 'text-rose-500',
    hover: 'hover:border-rose-600/45 hover:bg-rose-600/10',
  },
};

const categorySerializer = {
  parse: (value: string): Category => {
    if (categories.some((cat) => cat.id === value)) {
      return value as Category;
    }

    return 'MIXED';
  },
  stringify: (value: Category) => value,
};

function buildUrl(base: string, params: Record<string, string>) {
  const merged = { ...params };
  const search = new URLSearchParams(merged).toString();
  return search ? `${base}?${search}` : base;
}

export function MenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [canPlaySelection, setCanPlaySelection] = useState(true);
  const [requiredQuestions, setRequiredQuestions] = useState(10);
  const [availableQuestions, setAvailableQuestions] = useState<number | null>(null);
  const [disabledOptions, setDisabledOptions] = useState<{
    continents?: string[];
    difficulties?: string[];
    isInsular?: boolean;
    isLandlocked?: boolean;
  }>({});

  const [selectedCategory, setSelectedCategory] = useLocalStorage<Category>(
    'geochallenge:last-category',
    'MIXED',
    categorySerializer,
  );

  const { filters, setFilters, clearFilters } = useGameFilters();
  const filtersActive = hasActiveFilters(filters);
  const fp = filtersToParams(filters);

  function go(path: string, extra: Record<string, string> = {}) {
    if (!canPlaySelection) return;
    navigate(buildUrl(path, { ...fp, ...extra }));
  }

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const base = await api.getGameAvailability(selectedCategory, undefined, filters);
        if (!mounted) return;
        setCanPlaySelection(base.canPlay);
        setRequiredQuestions(base.required);
        setAvailableQuestions(base.available);

        const probeFilters: GameFilters[] = [
          { ...filters, isInsular: true },
          { ...filters, isLandlocked: true },
          ...CONTINENT_IDS.map((c) => ({ ...filters, continent: c })),
          ...DIFFICULTY_IDS.map((d) => ({ ...filters, difficulty: d as Difficulty })),
        ];

        const results = await Promise.all(
          probeFilters.map((f) =>
            api
              .getGameAvailability(selectedCategory, undefined, f)
              .then((r) => r.canPlay)
              .catch(() => true)
          )
        );
        if (!mounted) return;

        const insularPlayable = results[0];
        const landlockedPlayable = results[1];
        const continentResults = results.slice(2, 2 + CONTINENT_IDS.length);
        const difficultyResults = results.slice(2 + CONTINENT_IDS.length);

        setDisabledOptions({
          isInsular: !filters.isInsular && !insularPlayable,
          isLandlocked: !filters.isLandlocked && !landlockedPlayable,
          continents: CONTINENT_IDS.filter(
            (c, i) => c !== filters.continent && !continentResults[i]
          ),
          difficulties: DIFFICULTY_IDS.filter(
            (d, i) => d !== filters.difficulty && !difficultyResults[i]
          ),
        });
      } catch {
        if (!mounted) return;
        setCanPlaySelection(true);
        setAvailableQuestions(null);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [filters, selectedCategory]);

  function filterSummary(): string {
    const parts: string[] = [];
    if (filters.continent) parts.push(t(`filters.continents.${filters.continent.replace(' ', '_')}`));
    if (filters.isInsular) parts.push(t('filters.insular'));
    if (filters.isLandlocked) parts.push(t('filters.landlocked'));
    if (filters.difficulty) parts.push(t(`filters.difficulties.${filters.difficulty}`));
    return parts.join(' · ');
  }

  return (
    <PageTemplate
      header={
        <Header
          actions={
            <>
              <Link
                to="/profile"
                className="flex min-h-11 items-center gap-2 rounded-lg border border-app-border bg-app-surface px-2.5 py-1.5 text-app-secondary transition-colors hover:border-app-border hover:text-app-text"
              >
                <UserAvatar username={user?.username || ''} size="xs" />
                <span className="hidden max-w-20 truncate text-xs sm:inline sm:text-sm">
                  {user?.username}
                </span>
              </Link>
              <Button
                onClick={logout}
                variant="secondary"
                size="sm"
                title={t('auth.logout')}
                aria-label={t('auth.logout')}
              >
                <Icon symbol="🚪" />
              </Button>
            </>
          }
        />
      }
      contentClassName="py-2.5 pb-4 sm:py-3 sm:pb-6"
    >
      <section>
        <SectionTitle variant="label" className="mb-2 px-1 sm:px-0">
          {t('menu.selectCategory')}
        </SectionTitle>
        <CategorySelector
          categories={categories.map((cat) => ({ id: cat.id, icon: cat.icon, label: t(cat.labelKey), accentClass: cat.accentClass }))}
          selected={selectedCategory}
          onSelect={(id) => setSelectedCategory(id as Category)}
        />
      </section>

      {/* Filter bar */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setDrawerOpen(true)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            filtersActive
              ? 'border-primary/60 bg-primary/15 text-primary'
              : 'border-app-border bg-app-surface/80 text-app-subtle hover:border-app-border hover:text-app-secondary'
          }`}
        >
          <span>🎚️</span>
          <span>{filtersActive ? filterSummary() : t('filters.filterBy')}</span>
          {!filtersActive && <span className="opacity-50">▾</span>}
        </button>
        {filtersActive && (
          <button
            onClick={clearFilters}
            className="rounded-full border border-app-border bg-app-surface/80 px-2 py-1.5 text-xs text-app-subtle hover:text-red-400"
            title={t('filters.clearAll')}
          >
            ✕
          </button>
        )}
      </div>
      {!canPlaySelection && (
        <p className="mt-2 text-xs text-amber-300">
          {t('filters.unavailableCombination', {
            required: requiredQuestions,
            available: availableQuestions ?? 0,
          })}
        </p>
      )}


      
      <section className="mt-3" aria-label={t('menu.gameModes')}>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
          <GameModeCard
            icon="⚡"
            title={t('menu.flash')}
            description={t('menu.flashDesc')}
            onClick={() => go(`/game/flash`, { category: selectedCategory })}
            disabled={selectedCategory === 'MAP'}
            disabledHint={selectedCategory === 'MAP' ? t('menu.flashNoMap') : undefined}
            accent={GAME_MODE_ACCENTS.flash}
          />
          <GameModeCard
            icon="🎯"
            title={t('menu.singlePlayer')}
            description={t('menu.singlePlayerDesc')}
            onClick={() => go(`/game/single`, { category: selectedCategory })}
            accent={GAME_MODE_ACCENTS.single}
          />
          <GameModeCard
            icon="⚔️"
            title={t('menu.duel')}
            description={t('menu.duelDesc')}
            onClick={() => go(`/duel`, { category: selectedCategory })}
            accent={GAME_MODE_ACCENTS.duel}
          />
          <GameModeCard
            icon="🏁"
            title={t('menu.challenge')}
            description={t('menu.challengeDesc')}
            onClick={() => go(`/challenges`, { category: selectedCategory, openCreate: '1' })}
            accent={GAME_MODE_ACCENTS.challenge}
          />
          <GameModeCard
            icon="🔥"
            title={t('menu.streak')}
            description={t('menu.streakDesc')}
            onClick={() => go(`/game/single`, { category: selectedCategory, mode: 'streak' })}
            accent={GAME_MODE_ACCENTS.streak}
          />
          <GameModeCard
            icon="☠️"
            title={t('menu.survival')}
            description={t('menu.survivalDesc')}
            onClick={() => go(`/survival`, { category: selectedCategory })}
            accent={GAME_MODE_ACCENTS.survival}
          />
        </div>
      </section>

      {/* Daily Challenge Banner */}
      <Link
        to="/daily"
        className="mt-4 flex items-center gap-4 rounded-2xl border border-cyan-600/40 bg-gradient-to-r from-cyan-900/20 to-emerald-900/20 px-4 py-3.5 text-app-text transition-all hover:border-cyan-500/60 hover:from-cyan-800/30 hover:to-emerald-800/30 pressable"
      >
        <span className="shrink-0 text-3xl leading-none">📅</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-cyan-300">{t('menu.dailyChallenge', 'Reto del día')}</span>
            <span className="rounded-full border border-cyan-500/50 bg-cyan-500/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-cyan-300">
              {t('menu.dailyChallengeNew', 'Nuevo')}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-cyan-500/80">{t('menu.dailyChallengeDesc', '10 preguntas · mismas para todos · un intento')}</div>
        </div>
        <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 text-base font-bold">
          →
        </span>
      </Link>

      <section className="mt-4" aria-label={t('menu.quickActions')}>
        <SectionTitle variant="label" className="mb-2 px-1 sm:px-0">
          {t('menu.quickActions')}
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/rankings"
            className="pressable flex items-center gap-3 rounded-xl border border-app-border bg-app-surface/80 px-4 py-3 text-app-secondary transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <span className="text-2xl leading-none">🏆</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-app-text">{t('menu.rankings')}</div>
              <div className="truncate text-xs text-app-subtle">{t('menu.rankingsDesc')}</div>
            </div>
          </Link>
          <Link
            to="/profile"
            className="pressable flex items-center gap-3 rounded-xl border border-app-border bg-app-surface/80 px-4 py-3 text-app-secondary transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <span className="text-2xl leading-none">📊</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-app-text">{t('menu.yourStats')}</div>
              <div className="truncate text-xs text-app-subtle">{t('menu.yourStatsDesc')}</div>
            </div>
          </Link>
        </div>
      </section>

      {drawerOpen && (
        <FilterDrawer
          filters={filters}
          onChange={setFilters}
          onClose={() => setDrawerOpen(false)}
          disabledOptions={disabledOptions}
        />
      )}
    </PageTemplate>
  );
}
