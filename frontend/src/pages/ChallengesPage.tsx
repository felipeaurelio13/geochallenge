import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { LoadingSpinner } from '../components';

interface ChallengeParticipant {
  userId: string;
  score: number | null;
  user: { id: string; username: string };
}

interface Challenge {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'EXPIRED' | 'DECLINED';
  categories: string[];
  maxPlayers: number;
  answerTimeSeconds: 10 | 20 | 30;
  participantsCount: number;
  isJoinable: boolean;
  isUserParticipant: boolean;
  winnerId: string | null;
  createdAt: string;
  creator: { id: string; username: string };
  participants: ChallengeParticipant[];
}

type TabType = 'mine' | 'joinable' | 'completed';
const categories = ['MIXED', 'FLAG', 'CAPITAL', 'MAP', 'SILHOUETTE'];
const playerOptions = [2, 3, 4, 5, 6, 7, 8];

const categoryKeyByValue: Record<string, string> = {
  MIXED: 'mixed',
  FLAG: 'flags',
  CAPITAL: 'capitals',
  MAP: 'maps',
  SILHOUETTE: 'silhouettes',
};

export function ChallengesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('mine');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCategories, setCreateCategories] = useState<string[]>(['MIXED']);
  const [createMaxPlayers, setCreateMaxPlayers] = useState(2);
  const [createTime, setCreateTime] = useState<10 | 20 | 30>(20);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchChallenges = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ challenges: Challenge[] }>('/challenges');
      setChallenges(response.challenges);
    } catch (err) {
      console.error('Failed to fetch challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  const filteredChallenges = useMemo(() => challenges.filter((c) => {
    if (activeTab === 'mine') return c.isUserParticipant && c.status !== 'COMPLETED' && c.status !== 'EXPIRED';
    if (activeTab === 'joinable') return c.isJoinable;
    return c.status === 'COMPLETED' || c.status === 'EXPIRED';
  }), [activeTab, challenges]);

  const toggleCategory = (value: string) => {
    setCreateCategories((prev) => {
      if (value === 'MIXED') {
        return ['MIXED'];
      }

      const withoutMixed = prev.filter((c) => c !== 'MIXED');
      if (withoutMixed.includes(value)) {
        const next = withoutMixed.filter((c) => c !== value);
        return next.length ? next : ['MIXED'];
      }

      return [...withoutMixed, value];
    });
  };

  const handleJoin = async (challengeId: string) => {
    try {
      await api.post(`/challenges/${challengeId}/join`);
      fetchChallenges();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al unirse');
    }
  };

  const handlePlay = (challengeId: string) => navigate(`/challenges/${challengeId}/play`);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      await api.post('/challenges', {
        categories: createCategories,
        maxPlayers: createMaxPlayers,
        answerTimeSeconds: createTime,
      });
      setShowCreateModal(false);
      fetchChallenges();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear desafío');
    } finally {
      setCreating(false);
    }
  };

  const canPlay = (challenge: Challenge) => {
    if (challenge.status !== 'ACCEPTED' && challenge.status !== 'PENDING') return false;
    if (!challenge.isUserParticipant) return false;
    const me = challenge.participants.find((p) => p.userId === user?.id);
    return me?.score === null;
  };

  const getStatusLabel = (status: Challenge['status']) => t(`challenges.status.${status.toLowerCase()}`);
  const getCategoryLabel = (category: string) => t(`categories.${categoryKeyByValue[category] ?? 'mixed'}`);

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <Link to="/menu" className="text-gray-400 hover:text-white">← {t('common.back')}</Link>
          <h1 className="text-base sm:text-xl font-bold text-white">📨 {t('challenges.title')}</h1>
          <button onClick={() => setShowCreateModal(true)} className="px-3 py-2 bg-primary text-white rounded-lg text-sm">
            + {t('challenges.create')}
          </button>
        </div>
      </header>

      <div className="bg-gray-800/50 border-b border-gray-700 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-2 py-2 text-sm">
          {(['mine', 'joinable', 'completed'] as TabType[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`py-2 rounded-lg ${activeTab === tab ? 'bg-primary text-white' : 'text-gray-400 bg-gray-800'}`}>
              {t(`challenges.tabs.${tab}`)}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-4">
        {loading ? <LoadingSpinner size="lg" /> : filteredChallenges.length === 0 ? (
          <div className="text-center text-gray-400 py-16">{t('challenges.empty')}</div>
        ) : (
          <div className="space-y-3">
            {filteredChallenges.map((challenge) => {
              const hasStarted = challenge.status === 'ACCEPTED';
              const availableSlots = challenge.maxPlayers - challenge.participantsCount;
              const creatorLabel = `${t('challenges.from')} ${challenge.creator.username}`;

              return (
                <article key={challenge.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-white">{creatorLabel}</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {challenge.categories.map(getCategoryLabel).join(', ')} · {challenge.participantsCount}/{challenge.maxPlayers} · {challenge.answerTimeSeconds}s
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {challenge.isJoinable
                          ? t('challenges.availableSlots', { count: availableSlots })
                          : t('challenges.fullLobby')}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200">{getStatusLabel(challenge.status)}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {challenge.participants.map((p) => (
                      <span key={p.userId} className="px-2 py-1 rounded bg-gray-700 text-gray-200">
                        {p.user.username}: {p.score ?? '-'}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex gap-2">
                    {challenge.isJoinable && (
                      <button onClick={() => handleJoin(challenge.id)} className="flex-1 py-2 rounded-lg bg-blue-600 text-white">{t('challenges.join')}</button>
                    )}
                    {canPlay(challenge) && (
                      <button onClick={() => handlePlay(challenge.id)} className="flex-1 py-2 rounded-lg bg-primary text-white">
                        {hasStarted ? t('challenges.play') : t('challenges.waitingReady')}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center px-3 z-50">
          <div className="bg-gray-800 rounded-t-2xl sm:rounded-xl p-5 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">{t('challenges.createTitle')}</h2>
            {error && <p className="text-sm text-red-300 bg-red-900/40 p-2 rounded">{error}</p>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm text-gray-300 block mb-2">{t('challenges.categories')}</label>
                <p className="text-xs text-gray-400 mb-2">{t('challenges.categoriesHint')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`px-2 py-2 rounded-lg text-sm border ${createCategories.includes(category) ? 'bg-primary/20 border-primary text-white' : 'border-gray-600 text-gray-300'}`}
                    >
                      {getCategoryLabel(category)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">{t('challenges.maxPlayers')}</label>
                <p className="text-xs text-gray-400 mb-2">{t('challenges.maxPlayersHint')}</p>
                <div className="grid grid-cols-4 gap-2">
                  {playerOptions.map((playerCount) => (
                    <button
                      key={playerCount}
                      type="button"
                      onClick={() => setCreateMaxPlayers(playerCount)}
                      className={`py-2 rounded-lg text-sm ${createMaxPlayers === playerCount ? 'bg-primary text-white' : 'bg-gray-700 text-gray-200'}`}
                    >
                      {playerCount}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">{t('challenges.answerTime')}</label>
                <p className="text-xs text-gray-400 mb-2">{t('challenges.answerTimeHint')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 20, 30].map((time) => (
                    <button key={time} type="button" onClick={() => setCreateTime(time as 10 | 20 | 30)} className={`py-2 rounded-lg ${createTime === time ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'}`}>
                      {time}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 text-xs text-gray-300">
                {t('challenges.summary', {
                  categories: createCategories.map(getCategoryLabel).join(', '),
                  maxPlayers: createMaxPlayers,
                  answerTimeSeconds: createTime,
                })}
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={creating} className="flex-1 py-3 rounded-lg bg-primary text-white">{creating ? t('common.loading') : t('challenges.send')}</button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3 rounded-lg bg-gray-700 text-white">{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
