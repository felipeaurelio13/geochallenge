import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
} from '../types';

type ProfileTab = 'summary' | 'duels' | 'h2h';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();

  const hapticsEnabled = useUiStore((store) => store.hapticsEnabled);
  const soundEnabled = useUiStore((store) => store.soundEnabled);

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

  if (!user) {
    return (
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center">
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
    { key: 'h2h', label: t('duelHistory.tabs.headToHead') },
  ];

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-bg-app)]">
      <PageHeader title={t('nav.profile')} backTo="/menu" backLabel={`← ${t('common.back')}`} />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6 sm:py-8">
        <div className="text-center mb-6">
          <UserAvatar username={user.username} size="xl" className="mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">{user.username}</h2>
          <p className="text-gray-400">{user.email}</p>
        </div>

        {error && <Alert type="error" className="mb-4">{error}</Alert>}
        {success && <Alert type="success" className="mb-4">{success}</Alert>}

        {/* Tab bar */}
        <div className="flex rounded-xl bg-gray-800 p-1 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Resumen tab ── */}
        {activeTab === 'summary' && (
          <>
            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">{t('profile.statistics')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard value={user.highScore} label={t('stats.highScore')} color="primary" />
                <StatCard value={user.gamesPlayed} label={t('stats.gamesPlayed')} color="white" />
                <StatCard value={user.wins} label={t('stats.wins')} color="green" />
                <StatCard value={`${winRate}%`} label={t('stats.winRate')} color="yellow" />
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{t('profile.settings')}</h3>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="min-h-10 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 hover:text-primary/80"
                  >
                    {t('profile.edit')}
                  </button>
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
                    <div className="px-4 py-3 bg-gray-900 rounded-lg text-white">{user.username}</div>
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
                    <div className="px-4 py-3 bg-gray-900 rounded-lg text-white">
                      {preferredLanguage === 'es' ? t('profile.languageEs') : t('profile.languageEn')}
                    </div>
                  )}
                </div>

                <div>
                  <FormLabel>{t('auth.email')}</FormLabel>
                  <div className="px-4 py-3 bg-gray-900 rounded-lg text-gray-400">{user.email}</div>
                </div>

                {user.createdAt && (
                  <div>
                    <FormLabel>{t('profile.memberSince')}</FormLabel>
                    <div className="px-4 py-3 bg-gray-900 rounded-lg text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="flex-1 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <LoadingSpinner size="sm" /> : t('common.save')}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="flex-1 py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-gray-800 rounded-xl p-6 mt-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                {t('profile.gamePreferences', 'Preferencias de juego')}
              </h3>

              <div className="space-y-3">
                <label className="pressable flex cursor-pointer items-center justify-between rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 hover:border-gray-600">
                  <div className="pr-4">
                    <div className="text-sm font-medium text-white">
                      {t('profile.hapticsLabel', 'Vibración háptica')}
                    </div>
                    <div className="text-xs text-gray-400">
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
                    <div className={`h-6 w-11 rounded-full transition-colors duration-200 ${hapticsEnabled ? 'bg-primary' : 'bg-gray-600'}`} />
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${hapticsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </label>

                <label className="pressable flex cursor-pointer items-center justify-between rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 hover:border-gray-600">
                  <div className="pr-4">
                    <div className="text-sm font-medium text-white">
                      {t('profile.soundLabel', 'Sonidos')}
                    </div>
                    <div className="text-xs text-gray-400">
                      {t('profile.soundDescription', 'Efectos de sonido al responder (próximamente)')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(event) => uiStoreActions.setSoundEnabled(event.target.checked)}
                    className="sr-only"
                    aria-label={t('profile.soundLabel', 'Sonidos')}
                  />
                  <div className="relative flex-shrink-0" aria-hidden="true">
                    <div className={`h-6 w-11 rounded-full transition-colors duration-200 ${soundEnabled ? 'bg-primary' : 'bg-gray-600'}`} />
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${soundEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{activePeriodStats.wins}</div>
                  <div className="text-xs text-gray-400 mt-1">{t('duelHistory.stats.wins')}</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-gray-400">{activePeriodStats.draws}</div>
                  <div className="text-xs text-gray-400 mt-1">{t('duelHistory.stats.draws')}</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-400">{activePeriodStats.losses}</div>
                  <div className="text-xs text-gray-400 mt-1">{t('duelHistory.stats.losses')}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-gray-800 rounded-xl p-4 text-center animate-pulse">
                    <div className="h-7 bg-gray-700 rounded mb-2 mx-auto w-10" />
                    <div className="h-3 bg-gray-700 rounded mx-auto w-14" />
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
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Match list */}
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              {duelLoading && duelMatches.length === 0 ? (
                <div className="flex justify-center py-10">
                  <LoadingSpinner size="md" />
                </div>
              ) : duelMatches.length === 0 ? (
                <p className="text-center text-gray-500 py-10 text-sm">
                  {t('duelHistory.noMatches')}
                </p>
              ) : (
                <ul className="divide-y divide-gray-700">
                  {duelMatches.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <UserAvatar username={m.opponentUsername} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {m.opponentUsername}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(m.createdAt).toLocaleDateString()}
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
                              : 'bg-gray-700 text-gray-400'
                          }`}
                        >
                          {t(`duelHistory.result.${m.result}`)}
                        </span>
                        <div className="text-xs text-gray-400">
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
                className="w-full py-3 bg-gray-800 text-gray-400 hover:text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {duelLoading ? <LoadingSpinner size="sm" /> : t('duelHistory.loadMore')}
              </button>
            )}
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

                <div className="bg-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <UserAvatar username={selectedOpponent.opponent.username} size="md" />
                    <div>
                      <div className="font-semibold text-white">
                        {selectedOpponent.opponent.username}
                      </div>
                      <div className="text-xs text-gray-400">
                        {t('duelHistory.vsRecord', { name: selectedOpponent.opponent.username })}
                      </div>
                    </div>
                  </div>

                  {/* Stats per period */}
                  <div className="space-y-3">
                    {PERIODS.map((p) => {
                      const s = selectedOpponent.periods[p.key];
                      return (
                        <div key={p.key} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-14 shrink-0">{p.label}</span>
                          <div className="flex gap-1 flex-1">
                            <span className="flex-1 text-center py-1 rounded text-xs font-bold bg-green-500/15 text-green-400">
                              {s.wins}V
                            </span>
                            <span className="flex-1 text-center py-1 rounded text-xs font-bold bg-gray-700 text-gray-400">
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
                  <div className="bg-gray-800 rounded-xl overflow-hidden">
                    <h4 className="px-4 pt-4 pb-2 text-sm font-semibold text-white">
                      Últimas partidas
                    </h4>
                    <ul className="divide-y divide-gray-700">
                      {selectedOpponent.recentMatches.map((m) => (
                        <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-500">
                              {new Date(m.createdAt).toLocaleDateString()}
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
                                  : 'bg-gray-700 text-gray-400'
                              }`}
                            >
                              {t(`duelHistory.result.${m.result}`)}
                            </span>
                            <div className="text-xs text-gray-400">
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

                <div className="bg-gray-800 rounded-xl overflow-hidden">
                  <h4 className="px-4 pt-4 pb-2 text-sm font-semibold text-white">
                    {t('duelHistory.recentOpponents')}
                  </h4>

                  {opponentsLoading ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner size="md" />
                    </div>
                  ) : opponents.length === 0 ? (
                    <p className="text-center text-gray-500 py-8 text-sm px-4">
                      {t('duelHistory.noOpponents')}
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-700">
                      {opponents.map((opp) => (
                        <li key={opp.id}>
                          <button
                            onClick={() => handleSelectOpponent(opp.id)}
                            disabled={h2hLoading}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors text-left disabled:opacity-50"
                          >
                            <UserAvatar username={opp.username} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                {opp.username}
                              </div>
                              <div className="text-xs text-gray-500">
                                {opp.totalMatches}{' '}
                                {opp.totalMatches === 1 ? 'duelo' : 'duelos'}
                              </div>
                            </div>
                            <span className="text-gray-500 text-lg">›</span>
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
