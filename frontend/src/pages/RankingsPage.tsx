import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useApi, useDebounce } from '../hooks';
import { LoadingSpinner } from '../components';
import { PageHeader } from '../components/molecules/PageHeader';
import { EmptyState } from '../components/molecules/EmptyState';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';

interface LeaderboardEntry {
  rank: number;
  userId?: string;
  username: string;
  score: number;
  isCurrentUser?: boolean;
}

type RankingsResponse = {
  leaderboard: LeaderboardEntry[];
  totalPlayers: number;
  topScore: number | null;
  avgScore?: number | null;
  userRank: number | null;
  userScore: number | null;
};

const USE_BACKEND_RANK = import.meta.env.VITE_RANKING_USE_BACKEND_RANK === 'true';
const RANKING_NEIGHBORS_ENABLED = import.meta.env.VITE_RANKING_NEIGHBORS_ENABLED === 'true';

const PODIUM_COLORS = {
  1: {
    bg: 'bg-gradient-to-b from-yellow-400 to-yellow-600',
    border: 'border-yellow-400',
    text: 'text-yellow-400',
    glow: 'shadow-yellow-500/40',
    height: 'h-24',
    crown: '🥇',
  },
  2: {
    bg: 'bg-gradient-to-b from-slate-300 to-slate-500',
    border: 'border-slate-300',
    text: 'text-slate-300',
    glow: 'shadow-slate-400/40',
    height: 'h-16',
    crown: '🥈',
  },
  3: {
    bg: 'bg-gradient-to-b from-amber-600 to-amber-800',
    border: 'border-amber-600',
    text: 'text-amber-500',
    glow: 'shadow-amber-600/40',
    height: 'h-12',
    crown: '🥉',
  },
} as const;

function PodiumBlock({ entry, topScore, youLabel }: { entry: LeaderboardEntry; topScore: number; youLabel: string }) {
  const config = PODIUM_COLORS[entry.rank as 1 | 2 | 3];
  const pct = topScore > 0 ? Math.round((entry.score / topScore) * 100) : 0;

  if (!config) return null;

  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <span className={`text-2xl ${entry.rank === 1 ? 'animate-bounce' : ''}`}>{config.crown}</span>
      <div
        className={`w-14 h-14 rounded-full border-2 ${config.border} flex items-center justify-center bg-gray-800 shadow-lg ${config.glow} shadow-lg`}
        title={entry.username}
      >
        <span className="text-xl font-black">{entry.username.charAt(0).toUpperCase()}</span>
      </div>
      <span className={`text-xs font-bold truncate max-w-full px-1 ${entry.rank === 1 ? 'text-yellow-300' : 'text-gray-200'}`}>
        {entry.username}
        {entry.isCurrentUser && (
          <span className="ml-1 text-xs font-normal text-primary">({youLabel})</span>
        )}
      </span>
      <span className={`text-sm font-bold ${config.text}`}>
        {entry.score.toLocaleString()}
      </span>
      <div className={`w-full rounded-t-lg border ${config.border} border-b-0 ${config.bg} ${config.height} flex items-end justify-center pb-1`}>
        <span className={`text-xs font-bold text-white/80`}>{pct}%</span>
      </div>
    </div>
  );
}

function ScoreBar({ entry, topScore }: { entry: LeaderboardEntry; topScore: number }) {
  const pct = topScore > 0 ? Math.max(4, (entry.score / topScore) * 100) : 4;
  return (
    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${entry.isCurrentUser ? 'bg-primary' : 'bg-indigo-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function getRankBadgeStyle(rank: number, isCurrentUser?: boolean) {
  if (isCurrentUser) return 'bg-primary/30 border-primary';
  if (rank === 1) return 'bg-gradient-to-r from-yellow-500/20 to-yellow-700/20 border-yellow-500/60';
  if (rank === 2) return 'bg-gradient-to-r from-slate-400/20 to-slate-600/20 border-slate-400/60';
  if (rank === 3) return 'bg-gradient-to-r from-amber-600/20 to-amber-800/20 border-amber-600/60';
  return 'bg-gray-800/80 border-gray-700';
}

function getRankLabel(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export function RankingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [deferredUserRank, setDeferredUserRank] = useState<number | null>(null);
  const [deferredUserScore, setDeferredUserScore] = useState<number | null>(null);
  const [neighborEntries, setNeighborEntries] = useState<LeaderboardEntry[]>([]);
  const [neighborsLoading, setNeighborsLoading] = useState(false);

  const fetchRankings = useCallback(async () => {
    const leaderboardData = await api.getLeaderboard(50);

    return {
      leaderboard: leaderboardData.leaderboard.map((entry, index) => ({
        rank:
          USE_BACKEND_RANK && typeof entry.rank === 'number' && Number.isFinite(entry.rank)
            ? entry.rank
            : index + 1,
        userId: entry.userId,
        username: entry.username,
        score: entry.score,
        isCurrentUser: entry.username === user?.username,
      })),
      totalPlayers: leaderboardData.totalPlayers,
      topScore: leaderboardData.topScore,
      avgScore: leaderboardData.avgScore,
      userRank: leaderboardData.userRank?.rank ?? null,
      userScore: leaderboardData.userRank?.score ?? null,
    };
  }, [user?.username]);

  const useApiOptions = useMemo(
    () => ({
      cacheKey: `rankings-${user?.username ?? 'anonymous'}`,
      ttlMs: 60_000,
    }),
    [user?.username]
  );

  const { data, error, isLoading, run, invalidate } = useApi<RankingsResponse>(fetchRankings, useApiOptions);

  useEffect(() => {
    void run();
  }, [run]);

  useEffect(() => {
    if (!data) {
      return;
    }

    const shouldLoadRankContext = !!user && (RANKING_NEIGHBORS_ENABLED || data.userRank === null);

    if (!shouldLoadRankContext) {
      return;
    }

    let cancelled = false;
    setNeighborsLoading(true);

    void api
      .getMyRank()
      .then((rankContext) => {
        if (cancelled) {
          return;
        }

        if (data.userRank === null) {
          setDeferredUserRank(rankContext.userRank?.rank ?? null);
          setDeferredUserScore(rankContext.userRank?.score ?? null);
        }

        if (RANKING_NEIGHBORS_ENABLED) {
          setNeighborEntries(rankContext.neighbors ?? []);
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        if (RANKING_NEIGHBORS_ENABLED) {
          setNeighborEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setNeighborsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [data, user?.username]);

  const resolvedUserRank = data?.userRank ?? deferredUserRank;
  const resolvedUserScore = data?.userScore ?? deferredUserScore;

  const filteredLeaderboard = useMemo(() => {
    const source = data?.leaderboard ?? [];
    const normalizedSearch = debouncedSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return source;
    }

    return source.filter((entry) => entry.username.toLowerCase().includes(normalizedSearch));
  }, [data?.leaderboard, debouncedSearch]);

  const hasGlobalLeaderboardData = (data?.leaderboard.length ?? 0) > 0;
  const hasNoSearchResults = hasGlobalLeaderboardData && filteredLeaderboard.length === 0;
  const topScore = data?.topScore ?? 0;
  const isSearching = debouncedSearch.trim().length > 0;

  const top3 = useMemo(() => {
    if (isSearching) return [];
    return (data?.leaderboard ?? []).filter((e) => e.rank <= 3);
  }, [data?.leaderboard, isSearching]);

  const restEntries = useMemo(() => {
    if (isSearching) return filteredLeaderboard;
    return filteredLeaderboard.filter((e) => e.rank > 3);
  }, [filteredLeaderboard, isSearching]);

  // Reorder top3 for podium: 2nd, 1st, 3rd
  const podiumOrder = useMemo(() => {
    const first = top3.find((e) => e.rank === 1);
    const second = top3.find((e) => e.rank === 2);
    const third = top3.find((e) => e.rank === 3);
    return [second, first, third].filter(Boolean) as LeaderboardEntry[];
  }, [top3]);

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-bg-app)]">
      <PageHeader title={`🏆 ${t('rankings.title')}`} backTo="/menu" backLabel={`← ${t('common.back')}`} />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6">

        {/* My rank card — only when outside top 50 */}
        {resolvedUserRank && resolvedUserRank > 50 && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/50 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center text-lg font-black text-primary">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{t('rankings.yourPosition')}</p>
                <p className="text-white font-semibold">{user?.username}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-primary">#{resolvedUserRank}</p>
              <p className="text-sm text-gray-400">{resolvedUserScore?.toLocaleString()} pts</p>
            </div>
          </div>
        )}

        {/* Nearby context */}
        {!isLoading && !error && RANKING_NEIGHBORS_ENABLED && (
          <section className="mb-6 rounded-2xl border border-gray-700 bg-gray-800/60 p-4" aria-live="polite">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{t('rankings.nearbyContext')}</h2>
            {neighborsLoading ? (
              <p className="text-sm text-gray-400">{t('rankings.loadingNeighbors')}</p>
            ) : neighborEntries.length === 0 ? (
              <p className="text-sm text-gray-400">{t('rankings.noNeighborsData')}</p>
            ) : (
              <ul className="space-y-2">
                {neighborEntries.map((entry) => (
                  <li
                    key={entry.userId ? `${entry.userId}-${entry.rank}` : `${entry.username}-${entry.rank}`}
                    className="flex items-center justify-between rounded-xl border border-gray-700 bg-gray-900 px-3 py-2"
                  >
                    <span className="text-sm text-gray-200">#{entry.rank} {entry.username}</span>
                    <span className="text-sm font-semibold text-white">{entry.score.toLocaleString()} pts</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Search */}
        <div className="relative mb-5">
          <Input
            id="rankings-search"
            aria-label={t('common.search', { defaultValue: 'Buscar' })}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`text-sm ${search ? 'pr-11' : ''}`}
            placeholder={t('rankings.searchPlaceholder', { defaultValue: 'Buscar jugador...' })}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label={t('common.clear', { defaultValue: 'Limpiar búsqueda' })}
              className="absolute inset-y-0 right-0 flex min-w-[44px] items-center justify-center rounded-r-xl text-gray-400 transition-colors hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" text={t('rankings.loading')} />
          </div>
        )}

        {/* Error */}
        {error && (
          <EmptyState
            emoji="😢"
            message={error || ''}
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  invalidate();
                  void run();
                }}
              >
                {t('common.retry')}
              </Button>
            }
          />
        )}

        {!isLoading && !error && (
          <>
            {filteredLeaderboard.length === 0 ? (
              <EmptyState emoji="📊" message={t(hasNoSearchResults ? 'rankings.noSearchResults' : 'rankings.empty')} />
            ) : (
              <>
                {/* Podium top 3 — only when not searching */}
                {!isSearching && podiumOrder.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-end justify-center gap-3 px-4">
                      {podiumOrder.map((entry) => (
                        <PodiumBlock key={entry.userId ?? entry.username} entry={entry} topScore={topScore} youLabel={t('rankings.you')} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Rest of leaderboard (#4+) or all filtered results */}
                {restEntries.length > 0 && (
                  <div className="space-y-2">
                    {!isSearching && (
                      <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 px-1">{t('rankings.otherPlayers')}</p>
                    )}
                    {restEntries.map((entry) => (
                      <div
                        key={entry.userId ? `${entry.userId}-${entry.rank}` : `${entry.username}-${entry.rank}`}
                        className={`px-4 py-3 rounded-xl border transition-all duration-150 active:scale-[0.99] active:brightness-95 ${getRankBadgeStyle(entry.rank, entry.isCurrentUser)}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-bold min-w-[2.5rem] text-center ${entry.rank <= 3 ? 'text-2xl' : 'text-sm text-gray-400'}`}>
                            {getRankLabel(entry.rank)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-semibold text-white truncate">
                                {entry.username}
                                {entry.isCurrentUser && (
                                  <span className="ml-2 text-xs font-normal text-primary">({t('rankings.you')})</span>
                                )}
                              </span>
                              <span className="text-sm font-bold text-white whitespace-nowrap">
                                {entry.score.toLocaleString()} <span className="text-xs text-gray-400 font-normal">pts</span>
                              </span>
                            </div>
                            <ScoreBar entry={entry} topScore={topScore} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Also show top3 when searching and they match */}
                {isSearching && top3.length > 0 && filteredLeaderboard.some((e) => e.rank <= 3) && (
                  <div className="space-y-2 mt-2">
                    {filteredLeaderboard
                      .filter((e) => e.rank <= 3)
                      .map((entry) => (
                        <div
                          key={entry.userId ? `${entry.userId}-${entry.rank}` : `${entry.username}-${entry.rank}`}
                          className={`px-4 py-3 rounded-xl border transition-all duration-150 active:scale-[0.99] ${getRankBadgeStyle(entry.rank, entry.isCurrentUser)}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold min-w-[2.5rem] text-center">{getRankLabel(entry.rank)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-semibold text-white truncate">
                                  {entry.username}
                                  {entry.isCurrentUser && (
                                    <span className="ml-2 text-xs font-normal text-primary">({t('rankings.you')})</span>
                                  )}
                                </span>
                                <span className="text-sm font-bold text-white whitespace-nowrap">
                                  {entry.score.toLocaleString()} <span className="text-xs text-gray-400 font-normal">pts</span>
                                </span>
                              </div>
                              <ScoreBar entry={entry} topScore={topScore} />
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}

            {/* Stats panel */}
            {filteredLeaderboard.length > 0 && (
              <div className="mt-8 rounded-2xl border border-gray-700/60 bg-gray-800/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-700/60">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">{t('rankings.globalStats')}</h3>
                </div>
                <div className="grid grid-cols-3 divide-x divide-gray-700/60">
                  <div className="px-4 py-4 text-center">
                    <div className="text-2xl font-black text-primary">{(data?.totalPlayers ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">{t('rankings.totalPlayers')}</div>
                  </div>
                  <div className="px-4 py-4 text-center">
                    <div className="text-2xl font-black text-yellow-400">{(data?.topScore ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">{t('rankings.topScore')}</div>
                  </div>
                  <div className="px-4 py-4 text-center">
                    <div className="text-2xl font-black text-white">
                      {typeof data?.avgScore === 'number' && Number.isFinite(data.avgScore)
                        ? Math.round(data.avgScore).toLocaleString()
                        : '—'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{t('rankings.avgScore')}</div>
                  </div>
                </div>
                {isSearching && (
                  <div className="px-5 py-3 border-t border-gray-700/60 bg-gray-900/40">
                    <p className="text-xs text-gray-400">
                      {t('rankings.filteredResults')}: <span className="font-semibold text-white">{filteredLeaderboard.length}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
