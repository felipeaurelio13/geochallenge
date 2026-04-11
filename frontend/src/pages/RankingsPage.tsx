import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useApi, useDebounce } from '../hooks';
import { LoadingSpinner } from '../components';

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

export function RankingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [deferredUserRank, setDeferredUserRank] = useState<number | null>(null);
  const [deferredUserScore, setDeferredUserScore] = useState<number | null>(null);
  const [neighborEntries, setNeighborEntries] = useState<LeaderboardEntry[]>([]);
  const [neighborsLoading, setNeighborsLoading] = useState(false);

  const { data, error, isLoading, run, invalidate } = useApi<RankingsResponse>(
    async () => {
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
    },
    {
      cacheKey: `rankings-${user?.username ?? 'anonymous'}`,
      ttlMs: 60_000,
    }
  );

  useEffect(() => {
    void run();
  }, [run]);

  useEffect(() => {
    if (!data) {
      return;
    }

    let cancelled = false;
    const shouldLoadRankContext = RANKING_NEIGHBORS_ENABLED || data.userRank === null;

    if (!shouldLoadRankContext) {
      setNeighborEntries([]);
      setNeighborsLoading(false);
      return;
    }

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
  }, [data]);

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

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-600 to-yellow-800 border-yellow-500';
    if (rank === 2) return 'bg-gradient-to-r from-gray-400 to-gray-600 border-gray-400';
    if (rank === 3) return 'bg-gradient-to-r from-orange-700 to-orange-900 border-orange-600';
    return 'bg-gray-800 border-gray-700';
  };

  return (
    <div className="h-full min-h-0 bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/menu" className="text-gray-400 hover:text-white transition-colors">
            ← {t('common.back')}
          </Link>
          <h1 className="text-xl font-bold text-white">
            🏆 {t('rankings.title')}
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {resolvedUserRank && resolvedUserRank > 50 && (
          <div className="mb-6 p-4 bg-primary/20 border border-primary rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-primary">#{resolvedUserRank}</span>
                <span className="text-white font-semibold">{user?.username}</span>
              </div>
              <span className="text-xl font-bold text-white">{resolvedUserScore?.toLocaleString()} pts</span>
            </div>
          </div>
        )}

        {!isLoading && !error && RANKING_NEIGHBORS_ENABLED && (
          <section className="mb-6 rounded-xl border border-gray-700 bg-gray-800 p-4" aria-live="polite">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-300">Contexto cercano</h2>
            {neighborsLoading ? (
              <p className="text-sm text-gray-400">Cargando posiciones cercanas…</p>
            ) : neighborEntries.length === 0 ? (
              <p className="text-sm text-gray-400">No hay datos de vecinos disponibles.</p>
            ) : (
              <ul className="space-y-2">
                {neighborEntries.map((entry) => (
                  <li
                    key={entry.userId ? `${entry.userId}-${entry.rank}` : `${entry.username}-${entry.rank}`}
                    className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
                  >
                    <span className="text-sm text-gray-200">#{entry.rank} {entry.username}</span>
                    <span className="text-sm font-semibold text-white">{entry.score.toLocaleString()} pts</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="mb-4">
          <label htmlFor="rankings-search" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
            {t('common.search')}
          </label>
          <input
            id="rankings-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/60"
            placeholder={t('rankings.searchPlaceholder', { defaultValue: 'Buscar jugador...' })}
          />
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text={t('rankings.loading')} />
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">😢</div>
            <p className="text-gray-400">{error}</p>
            <button
              onClick={() => {
                invalidate();
                void run();
              }}
              className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <div className="space-y-3">
            {filteredLeaderboard.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📊</div>
                <p className="text-gray-400">{t('rankings.empty')}</p>
              </div>
            ) : (
              filteredLeaderboard.map((entry) => (
                <div
                  key={entry.userId ? `${entry.userId}-${entry.rank}` : `${entry.username}-${entry.rank}`}
                  className={`p-4 rounded-xl border-2 transition-transform hover:scale-[1.02] ${
                    entry.isCurrentUser ? 'bg-primary/20 border-primary' : getRankStyle(entry.rank)
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-2xl font-bold min-w-rank ${
                          entry.rank <= 3 ? 'text-3xl' : 'text-gray-400'
                        }`}
                      >
                        {getRankDisplay(entry.rank)}
                      </span>
                      <div>
                        <span className="text-white font-semibold">
                          {entry.username}
                          {entry.isCurrentUser && (
                            <span className="ml-2 text-xs text-primary">({t('rankings.you')})</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <span className="text-xl font-bold text-white">{entry.score.toLocaleString()} pts</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!isLoading && !error && filteredLeaderboard.length > 0 && (
          <div className="mt-8 p-6 bg-gray-800 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4">{t('rankings.stats')}</h3>
            <p className="mb-3 text-xs uppercase tracking-wide text-gray-400">Global</p>
            {search.trim() && (
              <p className="mb-4 text-sm text-gray-300">
                Resultados filtrados: <span className="font-semibold text-white">{filteredLeaderboard.length}</span>
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{data?.totalPlayers ?? 0}</div>
                <div className="text-sm text-gray-400">{t('rankings.totalPlayers')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{data?.topScore?.toLocaleString() ?? 0}</div>
                <div className="text-sm text-gray-400">{t('rankings.topScore')}</div>
              </div>
              {typeof data?.avgScore === 'number' && Number.isFinite(data.avgScore) && (
                <div>
                  <div className="text-2xl font-bold text-white">{Math.round(data.avgScore).toLocaleString()}</div>
                  <div className="text-sm text-gray-400">{t('rankings.avgScore')}</div>
                </div>
              )}
            </div>
            {search.trim() && (
              <p className="mt-4 text-xs uppercase tracking-wide text-gray-500">Filtrado por búsqueda</p>
            )}
            {!search.trim() && (
              <p className="mt-4 text-xs uppercase tracking-wide text-gray-500">Global</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
