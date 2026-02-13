import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { LoadingSpinner } from '../components';

interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  isCurrentUser?: boolean;
}

export function RankingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userScore, setUserScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const leaderboardData = await api.getLeaderboard(50);
        const userRankData = await api.getMyRank();

        const entries = leaderboardData.leaderboard.map((entry, index) => ({
          rank: index + 1,
          username: entry.username,
          score: entry.score,
          isCurrentUser: entry.username === user?.username,
        }));

        setLeaderboard(entries);
        setUserRank(userRankData.userRank?.rank || null);
        setUserScore(userRankData.userRank?.score || null);
      } catch (err) {
        setError(t('rankings.loadError'));
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.username, t]);

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
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/menu" className="text-gray-400 hover:text-white transition-colors">
            ← {t('common.back')}
          </Link>
          <h1 className="text-xl font-bold text-white">
            🏆 {t('rankings.title')}
          </h1>
          <div className="w-16" /> {/* Spacer */}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* User's Position (if not in top 50) */}
        {userRank && userRank > 50 && (
          <div className="mb-6 p-4 bg-primary/20 border border-primary rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-primary">#{userRank}</span>
                <span className="text-white font-semibold">{user?.username}</span>
              </div>
              <span className="text-xl font-bold text-white">
                {userScore?.toLocaleString()} pts
              </span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text={t('rankings.loading')} />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">😢</div>
            <p className="text-gray-400">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* Leaderboard */}
        {!loading && !error && (
          <div className="space-y-3">
            {leaderboard.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📊</div>
                <p className="text-gray-400">{t('rankings.empty')}</p>
              </div>
            ) : (
              leaderboard.map((entry) => (
                <div
                  key={entry.rank}
                  className={`p-4 rounded-xl border-2 transition-transform hover:scale-[1.02] ${
                    entry.isCurrentUser
                      ? 'bg-primary/20 border-primary'
                      : getRankStyle(entry.rank)
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-2xl font-bold min-w-[60px] ${
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
                    <span className="text-xl font-bold text-white">
                      {entry.score.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Stats Summary */}
        {!loading && !error && leaderboard.length > 0 && (
          <div className="mt-8 p-6 bg-gray-800 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              {t('rankings.stats')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {leaderboard.length}
                </div>
                <div className="text-sm text-gray-400">{t('rankings.totalPlayers')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {leaderboard[0]?.score.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-400">{t('rankings.topScore')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {Math.round(
                    leaderboard.reduce((acc, e) => acc + e.score, 0) / leaderboard.length
                  ).toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">{t('rankings.avgScore')}</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
