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

type Category = 'FLAG' | 'CAPITAL' | 'MAP' | 'SILHOUETTE' | 'MONUMENT' | 'MIXED';

const categories: { id: Category; icon: string; labelKey: string }[] = [
  { id: 'FLAG', icon: '🏳️', labelKey: 'categories.flags' },
  { id: 'CAPITAL', icon: '🏛️', labelKey: 'categories.capitals' },
  { id: 'MAP', icon: '🗺️', labelKey: 'categories.maps' },
  { id: 'SILHOUETTE', icon: '🖼️', labelKey: 'categories.silhouettes' },
  { id: 'MONUMENT', icon: '🗿', labelKey: 'categories.monuments' },
  { id: 'MIXED', icon: '🎲', labelKey: 'categories.mixed' },
];

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
                className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1.5 text-gray-200 transition-colors hover:border-gray-600 hover:text-white"
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
          categories={categories.map((cat) => ({ id: cat.id, icon: cat.icon, label: t(cat.labelKey) }))}
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
              ? 'border-primary/60 bg-primary/15 text-white'
              : 'border-gray-700 bg-gray-900/80 text-gray-400 hover:border-gray-500 hover:text-gray-200'
          }`}
        >
          <span>🎚️</span>
          <span>{filtersActive ? filterSummary() : t('filters.filterBy')}</span>
          {!filtersActive && <span className="opacity-50">▾</span>}
        </button>
        {filtersActive && (
          <button
            onClick={clearFilters}
            className="rounded-full border border-gray-700 bg-gray-900/80 px-2 py-1.5 text-xs text-gray-400 hover:text-red-400"
            title={t('filters.clearAll')}
          >
            ✕
          </button>
        )}
      </div>
      {!canPlaySelection && (
        <p className="mt-2 text-xs text-amber-300">{t('filters.unavailableCombination', { required: requiredQuestions })}</p>
      )}

      <section className="mt-3" aria-label={t('menu.gameModes')}>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-5">
          <GameModeCard
            icon="⚡"
            title={t('menu.flash')}
            description={t('menu.flashDesc')}
            onClick={() => go(`/game/flash`, { category: selectedCategory })}
            disabled={selectedCategory === 'MAP'}
            disabledHint={selectedCategory === 'MAP' ? t('menu.flashNoMap') : undefined}
          />
          <GameModeCard
            icon="🎯"
            title={t('menu.singlePlayer')}
            description={t('menu.singlePlayerDesc')}
            onClick={() => go(`/game/single`, { category: selectedCategory })}
          />
          <GameModeCard
            icon="⚔️"
            title={t('menu.duel')}
            description={t('menu.duelDesc')}
            onClick={() => go(`/duel`, { category: selectedCategory })}
          />
          <GameModeCard
            icon="🏁"
            title={t('menu.challenge')}
            description={t('menu.challengeDesc')}
            onClick={() => go(`/challenges`, { category: selectedCategory, openCreate: '1' })}
          />
          <GameModeCard
            icon="🔥"
            title={t('menu.streak')}
            description={t('menu.streakDesc')}
            onClick={() => go(`/game/single`, { category: selectedCategory, mode: 'streak' })}
          />
          <GameModeCard
            icon="☠️"
            title={t('menu.survival')}
            description={t('menu.survivalDesc')}
            onClick={() => go(`/survival`, { category: selectedCategory })}
            className="col-span-2 lg:col-span-1"
          />
        </div>
      </section>

      {/* Daily Challenge Banner */}
      <Link
        to="/daily"
        className="mt-4 flex items-center gap-4 rounded-2xl border border-cyan-700/60 bg-gradient-to-r from-cyan-950/60 to-emerald-950/60 px-4 py-3 text-white transition-all hover:border-cyan-500/60 hover:from-cyan-900/40 hover:to-emerald-900/40 pressable"
      >
        <span className="text-3xl leading-none">📅</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-cyan-300">{t('menu.dailyChallenge', 'Reto del día')}</div>
          <div className="text-xs text-cyan-500/80">{t('menu.dailyChallengeDesc', '10 preguntas · mismas para todos · un intento')}</div>
        </div>
        <span className="text-cyan-400 text-lg">→</span>
      </Link>

      <section className="mt-4" aria-label={t('menu.quickActions')}>
        <SectionTitle variant="label" className="mb-2 px-1 sm:px-0">
          {t('menu.quickActions')}
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/rankings"
            className="pressable flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/80 px-4 py-3 text-gray-100 transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <span className="text-2xl leading-none">🏆</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{t('menu.rankings')}</div>
              <div className="truncate text-xs text-gray-400">{t('menu.rankingsDesc')}</div>
            </div>
          </Link>
          <Link
            to="/profile"
            className="pressable flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/80 px-4 py-3 text-gray-100 transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <span className="text-2xl leading-none">📊</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{t('menu.yourStats')}</div>
              <div className="truncate text-xs text-gray-400">{t('menu.yourStatsDesc')}</div>
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
