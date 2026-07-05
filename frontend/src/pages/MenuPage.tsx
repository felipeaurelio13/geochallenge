import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from '../hooks';
import { useGameFilters } from '../hooks/useGameFilters';
import { Button, Header, Icon, PageTemplate, SectionTitle } from '../components';
import { LanguageSwitcher } from '../components/atoms/LanguageSwitcher';
import { UserAvatar } from '../components/atoms/UserAvatar';
import { CategorySelector } from '../components/molecules/CategorySelector';
import { GameModeCard } from '../components/molecules/GameModeCard';
import { FilterDrawer } from '../components/molecules/FilterDrawer';
import { Modal } from '../components/organisms/Modal';
import { hasActiveFilters, filtersToParams, type Difficulty, type GameFilters } from '../types';
import { api } from '../services/api';
import { CONTINENT_IDS, DIFFICULTY_IDS } from '../constants/filters';

type GameModeId = 'flash' | 'single' | 'duel' | 'challenge' | 'streak' | 'survival';

const HOWTO_SEEN_KEY_PREFIX = 'howto_seen_';

type Category = 'FLAG' | 'CAPITAL' | 'MAP' | 'SILHOUETTE' | 'MONUMENT' | 'CINEMA_GEO' | 'MIXED';

const categories: { id: Category; icon: string; labelKey: string; accentClass: string }[] = [
  { id: 'FLAG', icon: '🏳️', labelKey: 'categories.flags', accentClass: 'border-blue-500/50 bg-blue-500/15 text-blue-400' },
  { id: 'CAPITAL', icon: '🏛️', labelKey: 'categories.capitals', accentClass: 'border-green-500/50 bg-green-500/15 text-green-400' },
  { id: 'MAP', icon: '🗺️', labelKey: 'categories.maps', accentClass: 'border-teal-500/50 bg-teal-500/15 text-teal-400' },
  { id: 'SILHOUETTE', icon: '🖼️', labelKey: 'categories.silhouettes', accentClass: 'border-violet-500/50 bg-violet-500/15 text-violet-400' },
  { id: 'MONUMENT', icon: '🗿', labelKey: 'categories.monuments', accentClass: 'border-amber-500/50 bg-amber-500/15 text-amber-400' },
  { id: 'CINEMA_GEO', icon: '🎬', labelKey: 'categories.cinemaGeo', accentClass: 'border-rose-500/50 bg-rose-500/15 text-rose-400' },
  // QA fix HI-5: el accent previo (`text-slate-300` sobre `bg-slate-400/15`)
  // daba contraste ~1.8:1 y se veía MÁS DÉBIL que el estado no-seleccionado.
  // Usamos fuchsia para mantener la saturación 400 del resto del set y dar
  // la lectura "categoría sin temática fija" sin grisearse.
  { id: 'MIXED', icon: '🎲', labelKey: 'categories.mixed', accentClass: 'border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-400' },
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

function hasSeenHowTo(mode: GameModeId): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(`${HOWTO_SEEN_KEY_PREFIX}${mode}`) === '1';
  } catch {
    return true;
  }
}

function markHowToSeen(mode: GameModeId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${HOWTO_SEEN_KEY_PREFIX}${mode}`, '1');
  } catch {
    // noop: storage unavailable (private mode, quota)
  }
}

// "?" overlay button — no editamos GameModeCard (molécula compartida), sólo
// envolvemos la card en un contenedor relative y superponemos el botón.
function GameModeCardWithHelp({
  mode,
  modeLabel,
  onOpenHelp,
  children,
}: {
  mode: GameModeId;
  modeLabel: string;
  onOpenHelp: (mode: GameModeId) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative">
      {children}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenHelp(mode);
        }}
        aria-label={t('menu.howToPlayAria', { mode: modeLabel })}
        className="pressable absolute right-1 top-1 flex min-h-7 min-w-7 items-center justify-center rounded-full border border-app-border bg-app-surface/90 text-xs font-bold text-app-subtle shadow-sm transition-colors hover:border-primary/60 hover:text-primary"
      >
        ?
      </button>
    </div>
  );
}

function HowToPlayModal({
  mode,
  modeLabel,
  onClose,
  onPlay,
}: {
  mode: GameModeId | null;
  modeLabel: string;
  onClose: () => void;
  onPlay: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal.Root isOpen={mode !== null} onClose={onClose}>
      <Modal.Panel>
        {mode && (
          <>
            <div className="flex items-start justify-between gap-2">
              <Modal.Title>{modeLabel}</Modal.Title>
              <Modal.CloseButton>✕</Modal.CloseButton>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-app-secondary">
              <li>
                <span className="font-semibold text-app-text">🎯 {t('howto.objectiveLabel', 'Objetivo')}: </span>
                {t(`howto.${mode}.objective`)}
              </li>
              <li>
                <span className="font-semibold text-app-text">📏 {t('howto.ruleLabel', 'Regla')}: </span>
                {t(`howto.${mode}.rule`)}
              </li>
              <li>
                <span className="font-semibold text-app-text">💡 {t('howto.tipLabel', 'Tip')}: </span>
                {t(`howto.${mode}.tip`)}
              </li>
            </ul>
            <div className="mt-5">
              <Button type="button" fullWidth size="lg" onClick={onPlay}>
                {t('menu.letsPlay')}
              </Button>
            </div>
          </>
        )}
      </Modal.Panel>
    </Modal.Root>
  );
}

export function MenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [howToMode, setHowToMode] = useState<GameModeId | null>(null);
  // Distingue "el usuario tocó el ?" de "lo abrimos automáticamente la
  // primera vez" — sólo marcamos `howto_seen_*` y navegamos al confirmar en
  // el segundo caso; si el usuario sólo estaba consultando, cerrar no navega.
  const [howToAutoOpened, setHowToAutoOpened] = useState(false);
  const [pendingAutoPlay, setPendingAutoPlay] = useState<{ path: string; extra: Record<string, string> } | null>(null);
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

  // La primera vez que el usuario toca un modo, mostramos el modal de
  // "cómo se juega" en vez de navegar directo. Confirmar en el modal
  // ("¡Jugar!") sí navega; cerrar sin confirmar no lo hace.
  function goMode(mode: GameModeId, path: string, extra: Record<string, string> = {}) {
    if (!canPlaySelection) return;
    if (!hasSeenHowTo(mode)) {
      setPendingAutoPlay({ path, extra });
      setHowToAutoOpened(true);
      setHowToMode(mode);
      return;
    }
    go(path, extra);
  }

  function handleOpenHelp(mode: GameModeId) {
    setHowToAutoOpened(false);
    setPendingAutoPlay(null);
    setHowToMode(mode);
  }

  function handleCloseHowTo() {
    if (howToAutoOpened && howToMode) {
      markHowToSeen(howToMode);
    }
    setHowToMode(null);
    setHowToAutoOpened(false);
    setPendingAutoPlay(null);
  }

  function handleConfirmHowTo() {
    if (howToMode) {
      markHowToSeen(howToMode);
    }
    if (pendingAutoPlay) {
      go(pendingAutoPlay.path, pendingAutoPlay.extra);
    }
    setHowToMode(null);
    setHowToAutoOpened(false);
    setPendingAutoPlay(null);
  }

  const MODE_LABELS: Record<GameModeId, string> = {
    flash: t('menu.flash'),
    single: t('menu.singlePlayer'),
    duel: t('menu.duel'),
    challenge: t('menu.challenge'),
    streak: t('menu.streak'),
    survival: t('menu.survival'),
  };

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

  const activeFilterSummary = filterSummary();
  const filterButtonLabel = filtersActive
    ? t('filters.openActiveFilters', { summary: activeFilterSummary })
    : t('filters.openFilters');

  return (
    <PageTemplate
      header={
        <Header
          actions={
            <>
              <LanguageSwitcher />
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
        <p className="mb-2 px-1 text-xs text-app-subtle sm:px-0">
          {t('menu.categoryHelper', 'Elige cómo quieres practicar hoy. Puedes cambiar esta categoría en cualquier momento.')}
        </p>
        <CategorySelector
          categories={categories.map((cat) => ({ id: cat.id, icon: cat.icon, label: t(cat.labelKey), accentClass: cat.accentClass }))}
          selected={selectedCategory}
          onSelect={(id) => setSelectedCategory(id as Category)}
          ariaLabel={t('menu.categorySelectorLabel')}
        />
      </section>

      {/* Filter bar */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={filterButtonLabel}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            filtersActive
              ? 'border-primary/60 bg-primary/15 text-primary'
              : 'border-app-border bg-app-surface/80 text-app-subtle hover:border-app-border hover:text-app-secondary'
          }`}
        >
          <span aria-hidden="true">🎚️</span>
          <span>{filtersActive ? activeFilterSummary : t('filters.filterBy')}</span>
          {!filtersActive && <span aria-hidden="true" className="opacity-50">▾</span>}
        </button>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-app-border bg-app-surface/80 px-2 py-1.5 text-xs text-app-subtle hover:text-red-400"
            title={t('filters.clearActive')}
            aria-label={t('filters.clearActive')}
          >
            <span aria-hidden="true">✕</span>
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
        {/* QA round 3 design audit: el helper "Después elige el ritmo..." era
            redundante con el de arriba ("Elige cómo quieres practicar hoy").
            Lo removemos para acortar la página y reducir ruido visual. La
            sección sigue siendo identificable por su grid de cards. */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
          <GameModeCardWithHelp mode="flash" modeLabel={MODE_LABELS.flash} onOpenHelp={handleOpenHelp}>
            <GameModeCard
              icon="⚡"
              title={t('menu.flash')}
              description={t('menu.flashDesc')}
              onClick={() => goMode('flash', `/game/flash`, { category: selectedCategory })}
              disabled={selectedCategory === 'MAP'}
              disabledHint={selectedCategory === 'MAP' ? t('menu.flashNoMap') : undefined}
              accent={GAME_MODE_ACCENTS.flash}
            />
          </GameModeCardWithHelp>
          <GameModeCardWithHelp mode="single" modeLabel={MODE_LABELS.single} onOpenHelp={handleOpenHelp}>
            <GameModeCard
              icon="🎯"
              title={t('menu.singlePlayer')}
              description={t('menu.singlePlayerDesc')}
              onClick={() => goMode('single', `/game/single`, { category: selectedCategory })}
              accent={GAME_MODE_ACCENTS.single}
            />
          </GameModeCardWithHelp>
          <GameModeCardWithHelp mode="duel" modeLabel={MODE_LABELS.duel} onOpenHelp={handleOpenHelp}>
            <GameModeCard
              icon="⚔️"
              title={t('menu.duel')}
              description={t('menu.duelDesc')}
              onClick={() => goMode('duel', `/duel`, { category: selectedCategory })}
              accent={GAME_MODE_ACCENTS.duel}
            />
          </GameModeCardWithHelp>
          <GameModeCardWithHelp mode="challenge" modeLabel={MODE_LABELS.challenge} onOpenHelp={handleOpenHelp}>
            <GameModeCard
              icon="🏁"
              title={t('menu.challenge')}
              description={t('menu.challengeDesc')}
              onClick={() => goMode('challenge', `/challenges`, { category: selectedCategory, openCreate: '1' })}
              accent={GAME_MODE_ACCENTS.challenge}
            />
          </GameModeCardWithHelp>
          <GameModeCardWithHelp mode="streak" modeLabel={MODE_LABELS.streak} onOpenHelp={handleOpenHelp}>
            <GameModeCard
              icon="🔥"
              title={t('menu.streak')}
              description={t('menu.streakDesc')}
              onClick={() => goMode('streak', `/game/single`, { category: selectedCategory, mode: 'streak' })}
              accent={GAME_MODE_ACCENTS.streak}
            />
          </GameModeCardWithHelp>
          <GameModeCardWithHelp mode="survival" modeLabel={MODE_LABELS.survival} onOpenHelp={handleOpenHelp}>
            <GameModeCard
              icon="☠️"
              title={t('menu.survival')}
              description={t('menu.survivalDesc')}
              onClick={() => goMode('survival', `/survival`, { category: selectedCategory })}
              accent={GAME_MODE_ACCENTS.survival}
            />
          </GameModeCardWithHelp>
        </div>
      </section>

      {/* Flag Master Banner — modo dedicado de banderas con dificultad escalada.
          Contraste fuerte: gradiente opaco rojo→ámbar, texto blanco. Funciona en
          light y dark mode sin depender de variables del tema. */}
      <Link
        to="/flag-master"
        className="mt-4 flex items-center gap-4 rounded-2xl border border-red-500/70 bg-gradient-to-r from-red-700 to-amber-700 px-4 py-3.5 text-white shadow-md shadow-red-900/30 transition-all hover:from-red-600 hover:to-amber-600 hover:shadow-lg pressable"
      >
        <span aria-hidden="true" className="shrink-0 text-3xl leading-none drop-shadow">🏴</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{t('menu.flagMaster', 'Maestro de Banderas')}</span>
            <span className="rounded-full border border-white/40 bg-white/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
              {t('menu.flagMasterBadge', 'Difícil')}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-white/85">
            {t('menu.flagMasterDesc', '10 rondas · sin color, recortes y trampas · multiplicadores hasta x2.5')}
          </div>
        </div>
        <span aria-hidden="true" className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white text-base font-bold">
          →
        </span>
      </Link>

      {/* Daily Challenge Banner. Mismo principio: gradiente opaco + texto blanco. */}
      <Link
        to="/daily"
        className="mt-4 flex items-center gap-4 rounded-2xl border border-cyan-500/70 bg-gradient-to-r from-cyan-700 to-emerald-700 px-4 py-3.5 text-white shadow-md shadow-cyan-900/30 transition-all hover:from-cyan-600 hover:to-emerald-600 hover:shadow-lg pressable"
      >
        <span aria-hidden="true" className="shrink-0 text-3xl leading-none drop-shadow">📅</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{t('menu.dailyChallenge', 'Reto del día')}</span>
            <span className="rounded-full border border-white/40 bg-white/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
              {t('menu.dailyChallengeNew', 'Nuevo')}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-white/85">{t('menu.dailyChallengeDesc', '10 preguntas · mismas para todos · un intento')}</div>
        </div>
        <span aria-hidden="true" className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white text-base font-bold">
          →
        </span>
      </Link>

      <section className="mt-4" aria-label={t('menu.quickActions')}>
        <SectionTitle variant="label" className="mb-2 px-1 sm:px-0">
          {t('menu.quickActions')}
        </SectionTitle>
        <p className="mb-2 px-1 text-xs text-app-subtle sm:px-0">
          {t('menu.quickActionsHelper', 'Si prefieres, entra directo a tus stats o al ranking global.')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/rankings"
            className="pressable flex items-center gap-3 rounded-xl border border-app-border bg-app-surface/80 px-4 py-3 text-app-secondary transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <span aria-hidden="true" className="text-2xl leading-none">🏆</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-app-text">{t('menu.rankings')}</div>
              <div className="truncate text-xs text-app-subtle">{t('menu.rankingsDesc')}</div>
            </div>
          </Link>
          <Link
            to="/profile"
            className="pressable flex items-center gap-3 rounded-xl border border-app-border bg-app-surface/80 px-4 py-3 text-app-secondary transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <span aria-hidden="true" className="text-2xl leading-none">📊</span>
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

      <HowToPlayModal
        mode={howToMode}
        modeLabel={howToMode ? MODE_LABELS[howToMode] : ''}
        onClose={handleCloseHowTo}
        onPlay={handleConfirmHowTo}
      />
    </PageTemplate>
  );
}
