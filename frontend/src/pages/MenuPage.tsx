import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from '../hooks';
import { useGameFilters } from '../hooks/useGameFilters';
import { Button, Header, Icon, PageTemplate } from '../components';
import { LanguageSwitcher } from '../components/atoms/LanguageSwitcher';
import { UserAvatar } from '../components/atoms/UserAvatar';
import { FilterDrawer } from '../components/molecules/FilterDrawer';
import { Modal } from '../components/organisms/Modal';
import { LobbyJourneyCard } from '../components/organisms/LobbyJourneyCard';
import { LobbyModePanel } from '../components/organisms/LobbyModePanel';
import { filtersToParams, type Category, type Difficulty, type GameFilters, type MasterySummary, type DailyStatus, type WorldEventCurrentResponse } from '../types';
import { api } from '../services/api';
import { trackUxEvent } from '../utils/uxTelemetry';
import { CONTINENT_IDS, DIFFICULTY_IDS } from '../constants/filters';

type GameModeId = 'flash' | 'single' | 'duel' | 'challenge' | 'streak' | 'survival';
type LobbyPanel = 'practice' | 'compete' | null;

const HOWTO_SEEN_KEY_PREFIX = 'howto_seen_';

function formatTimeLeft(endsAt: string, finishedLabel: string): string {
  const now = Date.now();
  const end = new Date(endsAt).getTime();
  const diff = end - now;
  if (diff <= 0) return finishedLabel;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

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
    // noop: storage unavailable
  }
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
  const [masterySummary, setMasterySummary] = useState<MasterySummary | null>(null);
  const [masteryLoading, setMasteryLoading] = useState(true);
  const [dailyStatus, setDailyStatus] = useState<DailyStatus | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [eventData, setEventData] = useState<WorldEventCurrentResponse | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<LobbyPanel>(null);

  const [selectedCategory, setSelectedCategory] = useLocalStorage<Category>(
    'geochallenge:last-category',
    'MIXED',
    { parse: (v: string) => ['FLAG', 'CAPITAL', 'MAP', 'SILHOUETTE', 'MONUMENT', 'MIXED'].includes(v) ? v as Category : 'MIXED', stringify: (v: Category) => v },
  );

  const { filters, setFilters, clearFilters } = useGameFilters();
  const fp = filtersToParams(filters);

  function go(path: string, extra: Record<string, string> = {}, mode?: GameModeId) {
    if (!canPlaySelection) return;
    if (mode) {
      trackUxEvent('mode_selected', {
        destination: path,
        gameMode: mode,
        category: selectedCategory,
      });
    }
    navigate(buildUrl(path, { ...fp, ...extra }));
  }

  function goMode(mode: GameModeId, path: string, extra: Record<string, string> = {}) {
    if (!canPlaySelection) return;
    if (!hasSeenHowTo(mode)) {
      setPendingAutoPlay({ path, extra });
      setHowToAutoOpened(true);
      setHowToMode(mode);
      return;
    }
    go(path, extra, mode);
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
      go(pendingAutoPlay.path, pendingAutoPlay.extra, howToMode ?? undefined);
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

  // Availability: only when a panel is open
  useEffect(() => {
    if (activePanel === null) return;

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
  }, [filters, selectedCategory, activePanel]);

  // Mastery summary
  useEffect(() => {
    if (!user) return;
    setMasteryLoading(true);
    api.getMasterySummary()
      .then(setMasterySummary)
      .catch(() => setMasterySummary(null))
      .finally(() => setMasteryLoading(false));
  }, [user]);

  // Daily status
  useEffect(() => {
    if (!user) return;
    setDailyLoading(true);
    api.getDailyStatus()
      .then(setDailyStatus)
      .catch(() => {})
      .finally(() => setDailyLoading(false));
  }, [user]);

  // World Event status
  useEffect(() => {
    if (!user) return;
    setEventLoading(true);
    api.getCurrentEvent()
      .then(setEventData)
      .catch(() => {})
      .finally(() => setEventLoading(false));
  }, [user]);

  // app_open telemetry
  useEffect(() => {
    const key = 'geochallenge:app-open-fired';
    try {
      if (window.sessionStorage.getItem(key) === '1') return;
      window.sessionStorage.setItem(key, '1');
      trackUxEvent('app_open');
    } catch {
      trackUxEvent('app_open');
    }
  }, []);

  function togglePanel(panel: LobbyPanel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  function handleJourneyContinue() {
    trackUxEvent('mode_selected', {
      destination: '/game/single?gameType=practice',
      gameMode: 'practice',
      category: 'MIXED',
    });
    navigate('/game/single?gameType=practice');
  }

  function handleDailyPlay() {
    trackUxEvent('mode_selected', {
      destination: '/daily',
      gameMode: 'daily',
      category: 'MIXED',
    });
    navigate('/daily');
  }

  function handleEventPlay() {
    trackUxEvent('mode_selected', {
      destination: '/event',
      gameMode: 'event_boss',
      category: 'MIXED',
    });
    navigate('/event');
  }

  // Practice handlers
  function handlePlayClassic() {
    goMode('single', '/game/single', { category: selectedCategory });
  }

  function handlePlayFlash() {
    goMode('flash', '/game/flash', { category: selectedCategory });
  }

  function handlePlayStreak() {
    goMode('streak', '/game/single', { category: selectedCategory, mode: 'streak' });
  }

  // Compete handlers
  function handlePlayDuel() {
    goMode('duel', '/duel', { category: selectedCategory });
  }

  function handlePlayChallenge() {
    goMode('challenge', '/challenges', { category: selectedCategory, openCreate: '1' });
  }

  function handlePlaySurvival() {
    goMode('survival', '/survival', { category: selectedCategory });
  }

  function handleFlagMaster() {
    trackUxEvent('mode_selected', {
      destination: '/flag-master',
      gameMode: 'flag_master',
      category: 'MIXED',
    });
    navigate('/flag-master');
  }

  function handleGeoChallenges() {
    trackUxEvent('mode_selected', {
      destination: '/geo-challenges',
      gameMode: 'geo_challenges',
      category: 'MIXED',
    });
    navigate('/geo-challenges');
  }

  function handleGeoChallengesDuel() {
    trackUxEvent('mode_selected', {
      destination: '/duel?mode=geo-challenge',
      gameMode: 'geo_challenges_duel',
      category: 'MIXED',
    });
    navigate('/duel?mode=geo-challenge');
  }

  function handleCompetitionHub() {
    trackUxEvent('mode_selected', {
      destination: '/competition',
      gameMode: 'competition',
      category: 'MIXED',
    });
    navigate('/competition');
  }

  const practicePanelOpen = activePanel === 'practice';
  const competePanelOpen = activePanel === 'compete';

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
      {/* Journey Hero */}
      {user && (
        <div className="mb-3">
          <LobbyJourneyCard
            summary={masterySummary}
            loading={masteryLoading && !masterySummary}
            onContinue={handleJourneyContinue}
            onPassport={() => navigate('/passport')}
          />
        </div>
      )}

      {/* Daily Challenge */}
      {user && (
        <section className="mb-3 rounded-2xl border border-app-border bg-app-surface p-4">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="shrink-0 text-2xl leading-none">🌍</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-app-text">
                  {t('menu.daily.title')}
                </h2>
                <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
                  dailyStatus?.completed
                    ? 'border-green-500/40 bg-green-500/15 text-green-400'
                    : 'border-cyan-500/40 bg-cyan-500/15 text-cyan-400'
                }`}>
                  {dailyLoading
                    ? '...'
                    : dailyStatus?.completed
                      ? t('menu.daily.completed')
                      : t('menu.daily.available')}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-app-subtle">
                {t('menu.daily.desc')}
              </p>
              {dailyStatus?.completed && dailyStatus.result && (
                <p className="mt-1 text-xs text-app-secondary">
                  {t('menu.daily.todayScore', {
                    correct: dailyStatus.result.correctCount,
                    total: dailyStatus.result.totalQuestions,
                  })}
                  {dailyStatus.dailyStreak > 0 && (
                    <>
                      {' · '}
                      🔥 {dailyStatus.dailyStreak}
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleDailyPlay}
            className="mt-3 w-full rounded-lg bg-[var(--color-accent)] py-2 text-sm font-semibold text-white pressable"
          >
            {dailyStatus?.completed
              ? t('menu.daily.viewResult')
              : t('menu.daily.play')}
          </button>
        </section>
      )}

      {/* World Event */}
      {user && eventData && (
        <section className="mb-3 rounded-2xl border border-app-border bg-app-surface p-4">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="shrink-0 text-2xl leading-none">
              {eventData.event.region === 'AFRICA' && '🌍'}
              {eventData.event.region === 'AMERICAS' && '🌎'}
              {eventData.event.region === 'ASIA' && '🌏'}
              {eventData.event.region === 'EUROPE' && '🏰'}
              {eventData.event.region === 'OCEANIA' && '🏝️'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-app-text">
                  {t('worldEvent.expedition', {
                    region: t(`worldEvent.region.${eventData.event.region}`),
                  })}
                </h2>
                <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
                  eventData.boss.cleared
                    ? 'border-green-500/40 bg-green-500/15 text-green-400'
                    : eventData.boss.unlocked
                    ? 'border-orange-500/40 bg-orange-500/15 text-orange-400'
                    : 'border-cyan-500/40 bg-cyan-500/15 text-cyan-400'
                }`}>
                  {eventLoading
                    ? '...'
                    : eventData.boss.cleared
                      ? t('worldEvent.guardianDefeated')
                      : eventData.boss.unlocked
                      ? t('worldEvent.guardianAvailable')
                      : t('worldEvent.preparation')}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-app-subtle">
                {t('worldEvent.endsIn', { time: formatTimeLeft(eventData.event.endsAt, t('worldEvent.finished')) })}
              </p>
              {!eventData.boss.unlocked && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-app-subtle">
                    {t('worldEvent.correctAnswers', {
                      count: eventData.progress.correctInRegion,
                      required: eventData.progress.correctRequired,
                    })}
                  </p>
                  <p className="text-xs text-app-subtle">
                    {t('worldEvent.challengeTypes', {
                      count: eventData.progress.distinctCategories,
                      required: eventData.progress.categoriesRequired,
                    })}
                  </p>
                  <p className="text-xs text-app-subtle">
                    {eventData.progress.dailyCompleted ? '✓' : '○'} {t('worldEvent.dailyCompleted')}
                  </p>
                </div>
              )}
              {eventData.boss.cleared && (
                <p className="mt-1 text-xs text-app-secondary">
                  {t('worldEvent.best', { correct: eventData.boss.bestCorrect })} ·{' '}
                  {eventData.boss.attempts === 1
                    ? t('worldEvent.attempts', { count: eventData.boss.attempts })
                    : t('worldEvent.attemptsPlural', { count: eventData.boss.attempts })}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleEventPlay}
            className="mt-3 w-full rounded-lg bg-[var(--color-accent)] py-2 text-sm font-semibold text-white pressable"
          >
            {eventData.boss.cleared
              ? t('worldEvent.playAgain')
              : eventData.boss.unlocked
              ? t('worldEvent.faceBoss')
              : t('worldEvent.viewExpedition')}
          </button>
        </section>
      )}

      {/* Choose: Practice / Compete */}
      <div className="mb-3">
        <h2 className="px-1 text-sm font-semibold text-app-text sm:px-0">
          {t('menu.choose.title')}
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => togglePanel('practice')}
            aria-expanded={practicePanelOpen}
            aria-controls="panel-practice"
            className={`rounded-xl border p-4 text-left transition-colors pressable ${
              practicePanelOpen
                ? 'border-primary/60 bg-primary/10'
                : 'border-app-border bg-app-surface hover:border-primary/40 hover:bg-primary/5'
            }`}
          >
            <span aria-hidden="true" className="text-2xl leading-none">🎯</span>
            <div className="mt-2 text-sm font-semibold text-app-text">
              {t('menu.choose.practice')}
            </div>
            <div className="text-xs text-app-subtle">
              {t('menu.choose.practiceDesc')}
            </div>
          </button>

          <button
            type="button"
            onClick={() => togglePanel('compete')}
            aria-expanded={competePanelOpen}
            aria-controls="panel-compete"
            className={`rounded-xl border p-4 text-left transition-colors pressable ${
              competePanelOpen
                ? 'border-primary/60 bg-primary/10'
                : 'border-app-border bg-app-surface hover:border-primary/40 hover:bg-primary/5'
            }`}
          >
            <span aria-hidden="true" className="text-2xl leading-none">⚔️</span>
            <div className="mt-2 text-sm font-semibold text-app-text">
              {t('menu.choose.compete')}
            </div>
            <div className="text-xs text-app-subtle">
              {t('menu.choose.competeDesc')}
            </div>
          </button>
        </div>
      </div>

      {/* Practice Panel */}
      {practicePanelOpen && (
        <div id="panel-practice" className="mb-3">
          <LobbyModePanel
            type="practice"
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            filters={filters}
            onClearFilters={clearFilters}
            onOpenFilters={() => setDrawerOpen(true)}
            availability={canPlaySelection ? null : { canPlay: false, required: requiredQuestions, available: availableQuestions }}
            onPlayClassic={handlePlayClassic}
            onPlayFlash={handlePlayFlash}
            onPlayStreak={handlePlayStreak}
            onOpenHelp={(mode) => handleOpenHelp(mode as GameModeId)}
            onFlagMaster={handleFlagMaster}
            onGeoChallenges={handleGeoChallenges}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}

      {/* Compete Panel */}
      {competePanelOpen && (
        <div id="panel-compete" className="mb-3">
          <LobbyModePanel
            type="compete"
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            filters={filters}
            onClearFilters={clearFilters}
            onOpenFilters={() => setDrawerOpen(true)}
            availability={canPlaySelection ? null : { canPlay: false, required: requiredQuestions, available: availableQuestions }}
            onPlayDuel={handlePlayDuel}
            onPlayChallenge={handlePlayChallenge}
            onPlaySurvival={handlePlaySurvival}
            onCompetitionHub={handleCompetitionHub}
            onOpenHelp={(mode) => handleOpenHelp(mode as GameModeId)}
            onGeoChallengesDuel={handleGeoChallengesDuel}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}

      {/* More section */}
      <section className="mt-2">
        <h2 className="px-1 text-xs font-semibold text-app-subtle sm:px-0">
          {t('menu.more.title')}
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link
            to="/rankings"
            className="pressable flex items-center gap-3 rounded-xl border border-app-border bg-app-surface/80 px-4 py-3 text-app-secondary transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <span aria-hidden="true" className="text-2xl leading-none">🏆</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-app-text">{t('menu.more.rankings')}</div>
              <div className="truncate text-xs text-app-subtle">{t('menu.more.rankingsDesc')}</div>
            </div>
          </Link>
          <Link
            to="/profile"
            className="pressable flex items-center gap-3 rounded-xl border border-app-border bg-app-surface/80 px-4 py-3 text-app-secondary transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <span aria-hidden="true" className="text-2xl leading-none">📊</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-app-text">{t('menu.more.stats')}</div>
              <div className="truncate text-xs text-app-subtle">{t('menu.more.statsDesc')}</div>
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
