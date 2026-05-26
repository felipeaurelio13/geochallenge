import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useApi, useDebounce } from '../hooks';
import { LoadingSpinner } from '../components';
import { PageHeader } from '../components/molecules/PageHeader';
import { UserAvatar } from '../components/atoms/UserAvatar';
import { Alert } from '../components/atoms/Alert';
import { StatCard } from '../components/atoms/StatCard';
import { Input } from '../components/atoms/Input';
import { FormLabel } from '../components/atoms/FormLabel';
import { Button } from '../components/atoms/Button';
import { uiStoreActions, useUiStore } from '../store/useUiStore';
import type {
  DuelMatchRecord,
  DuelPeriodStats,
  DuelOpponent,
  HeadToHeadData,
  DuelPeriod,
  CategoryStat,
  EarnedAchievement,
} from '../types';

type ProfileTab = 'summary' | 'duels' | 'h2h' | 'history';

interface GameHistoryEntry {
  id: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  category: string | null;
  gameMode: 'SINGLE' | 'FLASH' | 'STREAK' | 'DUEL' | 'CHALLENGE';
  createdAt: string;
}

const GAME_MODE_ICONS: Record<GameHistoryEntry['gameMode'], string> = {
  SINGLE: '🎯',
  FLASH: '⚡',
  STREAK: '🔥',
  DUEL: '⚔️',
  CHALLENGE: '🏁',
};

const CATEGORY_LABEL_KEY: Record<string, string> = {
  FLAG: 'categories.flags',
  CAPITAL: 'categories.capitals',
  MAP: 'categories.maps',
  SILHOUETTE: 'categories.silhouettes',
  MONUMENT: 'categories.monuments',
  CINEMA_GEO: 'categories.cinemaGeo',
  MIXED: 'categories.mixed',
};

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const hapticsEnabled = useUiStore((store) => store.hapticsEnabled);

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [preferredLanguage, setPreferredLanguage] = useState<'es' | 'en'>(user?.preferredLanguage || 'es');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<ProfileTab>('summary');

  // Duels tab state
  const [duelStats, setDuelStats] = useState<DuelPeriodStats | null>(null);
  const [duelPeriod, setDuelPeriod] = useState<DuelPeriod>('all');
  const [duelMatches, setDuelMatches] = useState<DuelMatchRecord[]>([]);
  const [duelTotal, setDuelTotal] = useState(0);
  const [duelPage, setDuelPage] = useState(1);
  const [duelLoading, setDuelLoading] = useState(false);

  // H2H tab state
  const [h2hSearch, setH2hSearch] = useState('');
  const [opponents, setOpponents] = useState<DuelOpponent[]>([]);
  const [opponentsLoading, setOpponentsLoading] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState<HeadToHeadData | null>(null);
  const [h2hLoading, setH2hLoading] = useState(false);

  // History tab state
  const [historyEntries, setHistoryEntries] = useState<GameHistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Category stats and achievements
  const [categoryStats, setCategoryStats] = useState<CategoryStat[] | null>(null);
  const [achievements, setAchievements] = useState<EarnedAchievement[] | null>(null);

  const debouncedSearch = useDebounce(h2hSearch, 300);

  const { mutate, isLoading } = useApi(api.updateProfile);

  const loadDuelStats = useCallback(async () => {
    try {
      const stats = await api.getDuelStats();
      setDuelStats(stats);
    } catch {
      // silently fail — stats are non-critical
    }
  }, []);

  const loadDuelHistory = useCallback(async (period: DuelPeriod, page: number, append: boolean) => {
    setDuelLoading(true);
    try {
      const result = await api.getDuelHistory(period, page);
      setDuelMatches((prev) => (append ? [...prev, ...result.matches] : result.matches));
      setDuelTotal(result.total);
    } catch {
      // silently fail
    } finally {
      setDuelLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const list = await api.getGameHistory(50);
      setHistoryEntries(list as GameHistoryEntry[]);
    } catch {
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadStatsAndAchievements = useCallback(async () => {
    try {
      const [stats, ach] = await Promise.all([api.getCategoryStats(), api.getAchievements()]);
      setCategoryStats(stats);
      setAchievements(ach);
    } catch {
      // non-critical
    }
  }, []);

  const loadOpponents = useCallback(async (search: string) => {
    setOpponentsLoading(true);
    try {
      const list = await api.getDuelOpponents(search || undefined);
      setOpponents(list);
    } catch {
      // silently fail
    } finally {
      setOpponentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'summary' && categoryStats === null) {
      loadStatsAndAchievements();
    }
  }, [activeTab, categoryStats, loadStatsAndAchievements]);

  useEffect(() => {
    if (activeTab === 'duels' && !duelStats) {
      loadDuelStats();
      loadDuelHistory('all', 1, false);
    }
  }, [activeTab, duelStats, loadDuelStats, loadDuelHistory]);

  useEffect(() => {
    if (activeTab === 'h2h') {
      loadOpponents('');
    }
  }, [activeTab, loadOpponents]);

  useEffect(() => {
    if (activeTab === 'history' && historyEntries === null) {
      loadHistory();
    }
  }, [activeTab, historyEntries, loadHistory]);

  useEffect(() => {
    if (activeTab === 'h2h') {
      loadOpponents(debouncedSearch);
    }
  }, [debouncedSearch, activeTab, loadOpponents]);

  const handlePeriodChange = (period: DuelPeriod) => {
    setDuelPeriod(period);
    setDuelPage(1);
    loadDuelHistory(period, 1, false);
  };

  const handleLoadMore = () => {
    const nextPage = duelPage + 1;
    setDuelPage(nextPage);
    loadDuelHistory(duelPeriod, nextPage, true);
  };

  const handleSelectOpponent = async (opponentId: string) => {
    setH2hLoading(true);
    try {
      const data = await api.getDuelH2H(opponentId);
      setSelectedOpponent(data);
    } catch {
      // silently fail
    } finally {
      setH2hLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!user) {
      return;
    }

    const optimisticUser = {
      ...user,
      username,
      preferredLanguage,
    };

    try {
      const updatedUser = await mutate(
        () => api.updateProfile({ username, preferredLanguage }),
        { optimisticData: optimisticUser, rollbackData: user }
      );

      updateUser(updatedUser);
      i18n.changeLanguage(preferredLanguage);
      setSuccess(t('profile.updateSuccess'));
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || t('profile.updateError'));
    }
  };

  const handleCancel = () => {
    setUsername(user?.username || '');
    setPreferredLanguage(user?.preferredLanguage || 'es');
    setIsEditing(false);
    setError('');
  };

  const challengeCategory = useMemo(() => {
    if (!selectedOpponent || selectedOpponent.recentMatches.length === 0) {
      return 'MIXED';
    }
    const counts = new Map<string, number>();
    for (const match of selectedOpponent.recentMatches) {
      const key = (match.category || 'MIXED').toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let bestKey = 'MIXED';
    let bestCount = -1;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    }
    return bestKey;
  }, [selectedOpponent]);

  if (!user) {
    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const winRate = user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0;
  const activePeriodStats = duelStats?.[duelPeriod];

  const PERIODS: { key: DuelPeriod; label: string }[] = [
    { key: 'week', label: t('duelHistory.periods.week') },
    { key: 'month', label: t('duelHistory.periods.month') },
    { key: 'year', label: t('duelHistory.periods.year') },
    { key: 'all', label: t('duelHistory.periods.all') },
  ];

  const TABS: { key: ProfileTab; label: string }[] = [
    { key: 'summary', label: t('duelHistory.tabs.summary') },
    { key: 'duels', label: t('duelHistory.tabs.duels') },
    { key: 'history', label: t('duelHistory.tabs.history') },
    { key: 'h2h', label: t('duelHistory.tabs.headToHead') },
  ];

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-bg-app)]">
      <PageHeader title={t('nav.profile')} backTo="/menu" backLabel={`← ${t('common.back')}`} />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6 sm:py-8">
        <div className="text-center mb-6">
          <UserAvatar username={user.username} size="xl" className="mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-app-text">{user.username}</h2>
          <p className="text-[var(--color-text-muted)]">{user.email}</p>
        </div>

        {error && <Alert type="error" className="mb-4">{error}</Alert>}
        {success && <Alert type="success" className="mb-4">{success}</Alert>}

        {/* Tab bar */}
        <div className="flex rounded-xl bg-[var(--color-surface-muted)] p-1 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-white'
                  : 'text-[var(--color-text-muted)] hover:text-app-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Resumen tab ── */}
        {activeTab === 'summary' && (
          <>
            <div className="bg-[var(--color-surface)] rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-app-text mb-4">{t('profile.statistics')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard value={user.highScore} label={t('stats.highScore')} color="primary" />
                <StatCard value={user.gamesPlayed} label={t('stats.gamesPlayed')} color="white" />
                {/* QA fix LO-6: cero no es éxito ni alerta; usar neutral hasta
                    que haya datos reales. Antes "0 Victorias" salía en verde y
                    "0% Tasa de victoria" en amarillo, ambos engañosos. */}
                <StatCard value={user.wins} label={t('stats.wins')} color={user.wins > 0 ? 'green' : 'white'} />
                <StatCard value={`${winRate}%`} label={t('stats.winRate')} color={user.gamesPlayed > 0 && winRate > 0 ? 'yellow' : 'white'} />
              </div>
            </div>

            {/* Category performance */}
            {categoryStats && categoryStats.length > 0 && (
              <div className="bg-[var(--color-surface)] rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-app-text mb-4">{t('profile.categoryPerformance', 'Rendimiento por categoría')}</h3>
                <div className="space-y-3">
                  {categoryStats
                    .filter((s) => s.totalQuestions > 0)
                    .sort((a, b) => b.accuracy - a.accuracy)
                    .map((stat) => {
                      const labelKey = `categories.${stat.category.toLowerCase()}s`;
                      const label = t(labelKey, stat.category);
                      const CATEGORY_ICONS: Record<string, string> = {
                        FLAG: '🚩', CAPITAL: '🏛️', MAP: '🗺️',
                        SILHOUETTE: '🌑', MONUMENT: '🗿', CINEMA_GEO: '🎬', MIXED: '🎯',
                      };
                      return (
                        <div key={stat.category}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                              <span>{CATEGORY_ICONS[stat.category] ?? '🎯'}</span>
                              {label}
                            </span>
                            <span className="font-semibold text-app-text">{stat.accuracy}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--color-surface-muted)]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                              style={{ width: `${stat.accuracy}%` }}
                            />
                          </div>
                          <div className="mt-0.5 text-right text-xs text-[var(--color-text-muted)]">
                            {stat.correctCount}/{stat.totalQuestions}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Achievements */}
            {achievements && achievements.length > 0 && (
              <div className="bg-[var(--color-surface)] rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-app-text mb-4">{t('profile.achievements', 'Logros')}</h3>
                {/* QA fix ME-6: antes `sm:grid-cols-3` dejaba el 4to logro
                    huérfano en una fila vacía. `auto-fit` deja que cada fila
                    se llene completa sin importar cuántos logros haya. */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
                  {achievements.map((ach) => (
                    <div
                      key={ach.key}
                      className="flex flex-col items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-center"
                    >
                      <span className="text-3xl">{ach.icon}</span>
                      <span className="text-xs font-semibold text-app-text">
                        {i18n.language === 'en' ? ach.nameEn : ach.nameEs}
                      </span>
                      <span className="text-[0.65rem] text-[var(--color-text-muted)]">
                        {/* QA fix ME-5: locale del i18n, no del browser.
                            Antes mostraba 5/25/2026 en español (formato US). */}
                        {new Date(ach.earnedAt).toLocaleDateString(i18n.language)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[var(--color-surface)] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-app-text">{t('profile.settings')}</h3>
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="text-primary hover:bg-primary/10"
                  >
                    {t('profile.edit')}
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <FormLabel>{t('auth.username')}</FormLabel>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      minLength={3}
                      maxLength={20}
                    />
                  ) : (
                    <div className="px-4 py-3 bg-[var(--color-surface-muted)] rounded-lg text-[var(--color-text-primary)]">{user.username}</div>
                  )}
                </div>

                <div>
                  <FormLabel>{t('profile.language')}</FormLabel>
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-2">
                      {(['es', 'en'] as const).map((lang) => (
                        <Button
                          key={lang}
                          variant={preferredLanguage === lang ? 'primary' : 'secondary'}
                          size="md"
                          onClick={() => setPreferredLanguage(lang)}
                          aria-pressed={preferredLanguage === lang}
                        >
                          {lang === 'es' ? t('profile.languageEs') : t('profile.languageEn')}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 bg-[var(--color-surface-muted)] rounded-lg text-[var(--color-text-primary)]">
                      {preferredLanguage === 'es' ? t('profile.languageEs') : t('profile.languageEn')}
                    </div>
                  )}
                </div>

                <div>
                  <FormLabel>{t('auth.email')}</FormLabel>
                  <div className="px-4 py-3 bg-[var(--color-surface-muted)] rounded-lg text-[var(--color-text-muted)]">{user.email}</div>
                </div>

                {user.createdAt && (
                  <div>
                    <FormLabel>{t('profile.memberSince')}</FormLabel>
                    <div className="px-4 py-3 bg-[var(--color-surface-muted)] rounded-lg text-[var(--color-text-muted)]">
                      {new Date(user.createdAt).toLocaleDateString(i18n.language)}
                    </div>
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleSave}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2"
                  >
                    {isLoading ? <LoadingSpinner size="sm" /> : t('common.save')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={handleCancel}
                    disabled={isLoading}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-[var(--color-surface)] rounded-xl p-6 mt-6">
              <h3 className="text-lg font-semibold text-app-text mb-4">
                {t('profile.gamePreferences', 'Preferencias de juego')}
              </h3>

              <div className="space-y-3">
                <label className="pressable flex cursor-pointer items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 hover:border-gray-500">
                  <div className="pr-4">
                    <div className="text-sm font-medium text-app-text">
                      {t('profile.hapticsLabel', 'Vibración háptica')}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {t('profile.hapticsDescription', 'Feedback táctil en toques, aciertos y errores')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={hapticsEnabled}
                    onChange={(event) => uiStoreActions.setHapticsEnabled(event.target.checked)}
                    className="sr-only"
                    aria-label={t('profile.hapticsLabel', 'Vibración háptica')}
                  />
                  <div className="relative flex-shrink-0" aria-hidden="true">
                    <div className={`h-6 w-11 rounded-full transition-colors duration-200 ${hapticsEnabled ? 'bg-primary' : 'bg-app-muted'}`} />
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${hapticsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </label>

              </div>
            </div>
          </>
        )}

        {/* ── Duelos tab ── */}
        {activeTab === 'duels' && (
          <div className="space-y-4">
            {/* W / D / L summary cards */}
            {activePeriodStats ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[var(--color-surface)] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{activePeriodStats.wins}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">{t('duelHistory.stats.wins')}</div>
                </div>
                <div className="bg-[var(--color-surface)] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[var(--color-text-secondary)]">{activePeriodStats.draws}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">{t('duelHistory.stats.draws')}</div>
                </div>
                <div className="bg-[var(--color-surface)] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-400">{activePeriodStats.losses}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">{t('duelHistory.stats.losses')}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-[var(--color-surface)] rounded-xl p-4 text-center animate-pulse">
                    <div className="h-7 bg-[var(--color-surface-muted)] rounded mb-2 mx-auto w-10" />
                    <div className="h-3 bg-[var(--color-surface-muted)] rounded mx-auto w-14" />
                  </div>
                ))}
              </div>
            )}

            {/* Period filter */}
            <div className="flex gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePeriodChange(p.key)}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                    duelPeriod === p.key
                      ? 'bg-primary text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-app-text'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Match list */}
            <div className="bg-[var(--color-surface)] rounded-xl overflow-hidden">
              {duelLoading && duelMatches.length === 0 ? (
                <div className="flex justify-center py-10">
                  <LoadingSpinner size="md" />
                </div>
              ) : duelMatches.length === 0 ? (
                <p className="text-center text-[var(--color-text-muted)] py-10 text-sm">
                  {t('duelHistory.noMatches')}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {duelMatches.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <UserAvatar username={m.opponentUsername} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-app-text truncate">
                          {m.opponentUsername}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {new Date(m.createdAt).toLocaleDateString(i18n.language)}
                          {m.category && (
                            <span className="ml-2 capitalize">{m.category.toLowerCase()}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-1 ${
                            m.result === 'win'
                              ? 'bg-green-500/20 text-green-400'
                              : m.result === 'loss'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
                          }`}
                        >
                          {t(`duelHistory.result.${m.result}`)}
                        </span>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {m.myScore} – {m.opponentScore}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Load more */}
            {duelMatches.length < duelTotal && (
              <button
                onClick={handleLoadMore}
                disabled={duelLoading}
                className="w-full py-3 bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-app-text rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {duelLoading ? <LoadingSpinner size="sm" /> : t('duelHistory.loadMore')}
              </button>
            )}
          </div>
        )}

        {/* ── Historial tab ── */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-[var(--color-surface)] rounded-xl overflow-hidden">
              {historyLoading && historyEntries === null ? (
                <div className="flex justify-center py-10">
                  <LoadingSpinner size="md" />
                </div>
              ) : !historyEntries || historyEntries.length === 0 ? (
                <p className="text-center text-[var(--color-text-muted)] py-10 text-sm px-4">
                  {t('gameHistory.empty')}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {historyEntries.map((entry) => {
                    const accuracy = entry.totalQuestions > 0
                      ? Math.round((entry.correctCount / entry.totalQuestions) * 100)
                      : 0;
                    const accuracyColor =
                      accuracy >= 80
                        ? 'text-green-400'
                        : accuracy >= 50
                        ? 'text-yellow-400'
                        : 'text-red-400';
                    const categoryLabel = entry.category
                      ? t(CATEGORY_LABEL_KEY[entry.category] || 'categories.mixed')
                      : null;
                    return (
                      <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-2xl leading-none" aria-hidden="true">
                          {GAME_MODE_ICONS[entry.gameMode] ?? '🎮'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-app-text truncate">
                            {t(`gameHistory.modes.${entry.gameMode}`, entry.gameMode)}
                            {categoryLabel && (
                              <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                                · {categoryLabel}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {new Date(entry.createdAt).toLocaleDateString(i18n.language)}
                            <span className="mx-1.5">·</span>
                            {t('gameHistory.accuracy', {
                              correct: entry.correctCount,
                              total: entry.totalQuestions,
                            })}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-base font-bold text-primary">{entry.score}</div>
                          <div className={`text-xs font-medium ${accuracyColor}`}>{accuracy}%</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ── Cara a cara tab ── */}
        {activeTab === 'h2h' && (
          <div className="space-y-4">
            {selectedOpponent ? (
              <>
                {/* H2H detail view */}
                <button
                  onClick={() => setSelectedOpponent(null)}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  ← {t('common.back')}
                </button>

                <div className="bg-[var(--color-surface)] rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <UserAvatar username={selectedOpponent.opponent.username} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-app-text truncate">
                        {selectedOpponent.opponent.username}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] truncate">
                        {t('duelHistory.vsRecord', { name: selectedOpponent.opponent.username })}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    onClick={() => navigate(`/duel?category=${challengeCategory}`)}
                    className="pressable mb-4 flex items-center justify-center gap-2"
                  >
                    <span aria-hidden="true">⚔️</span>
                    <span>{t('duelHistory.challengeAgain')}</span>
                  </Button>
                  <p className="-mt-3 mb-4 text-center text-[11px] text-[var(--color-text-muted)]">
                    {t('duelHistory.challengeHint', {
                      category: t(CATEGORY_LABEL_KEY[challengeCategory] || 'categories.mixed'),
                    })}
                  </p>

                  {/* Stats per period */}
                  <div className="space-y-3">
                    {PERIODS.map((p) => {
                      const s = selectedOpponent.periods[p.key];
                      return (
                        <div key={p.key} className="flex items-center gap-3">
                          <span className="text-xs text-[var(--color-text-muted)] w-14 shrink-0">{p.label}</span>
                          <div className="flex gap-1 flex-1">
                            <span className="flex-1 text-center py-1 rounded text-xs font-bold bg-green-500/15 text-green-400">
                              {s.wins}V
                            </span>
                            <span className="flex-1 text-center py-1 rounded text-xs font-bold bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
                              {s.draws}E
                            </span>
                            <span className="flex-1 text-center py-1 rounded text-xs font-bold bg-red-500/15 text-red-400">
                              {s.losses}D
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent matches */}
                {selectedOpponent.recentMatches.length > 0 && (
                  <div className="bg-[var(--color-surface)] rounded-xl overflow-hidden">
                    <h4 className="px-4 pt-4 pb-2 text-sm font-semibold text-app-text">
                      Últimas partidas
                    </h4>
                    <ul className="divide-y divide-[var(--color-border)]">
                      {selectedOpponent.recentMatches.map((m) => (
                        <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-[var(--color-text-muted)]">
                              {new Date(m.createdAt).toLocaleDateString(i18n.language)}
                              {m.category && (
                                <span className="ml-2 capitalize">{m.category.toLowerCase()}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-1 ${
                                m.result === 'win'
                                  ? 'bg-green-500/20 text-green-400'
                                  : m.result === 'loss'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
                              }`}
                            >
                              {t(`duelHistory.result.${m.result}`)}
                            </span>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              {m.myScore} – {m.opponentScore}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Opponent search */}
                <Input
                  type="text"
                  placeholder={t('duelHistory.search')}
                  value={h2hSearch}
                  onChange={(e) => setH2hSearch(e.target.value)}
                />

                <div className="bg-[var(--color-surface)] rounded-xl overflow-hidden">
                  <h4 className="px-4 pt-4 pb-2 text-sm font-semibold text-white">
                    {t('duelHistory.recentOpponents')}
                  </h4>

                  {opponentsLoading ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner size="md" />
                    </div>
                  ) : opponents.length === 0 ? (
                    <p className="text-center text-[var(--color-text-muted)] py-8 text-sm px-4">
                      {t('duelHistory.noOpponents')}
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--color-border)]">
                      {opponents.map((opp) => (
                        <li key={opp.id}>
                          <button
                            onClick={() => handleSelectOpponent(opp.id)}
                            disabled={h2hLoading}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-muted)] transition-colors text-left disabled:opacity-50"
                          >
                            <UserAvatar username={opp.username} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-app-text truncate">
                                {opp.username}
                              </div>
                              <div className="text-xs text-[var(--color-text-muted)]">
                                {opp.totalMatches}{' '}
                                {opp.totalMatches === 1 ? 'duelo' : 'duelos'}
                              </div>
                            </div>
                            <span className="text-[var(--color-text-muted)] text-lg">›</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
