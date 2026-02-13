import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { LoadingSpinner } from '../components';

interface Challenge {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'EXPIRED' | 'DECLINED';
  category: string | null;
  challengerScore: number | null;
  challengedScore: number | null;
  winnerId: string | null;
  createdAt: string;
  expiresAt: string;
  challenger: { id: string; username: string };
  challenged: { id: string; username: string };
}

type TabType = 'received' | 'sent' | 'completed';

export function ChallengesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('received');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createCategory, setCreateCategory] = useState<string>('MIXED');
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

  const filteredChallenges = challenges.filter((c) => {
    if (activeTab === 'received') {
      return c.challenged.id === user?.id && (c.status === 'PENDING' || c.status === 'ACCEPTED');
    }
    if (activeTab === 'sent') {
      return c.challenger.id === user?.id && (c.status === 'PENDING' || c.status === 'ACCEPTED');
    }
    if (activeTab === 'completed') {
      return c.status === 'COMPLETED' || c.status === 'EXPIRED' || c.status === 'DECLINED';
    }
    return false;
  });

  const handleAccept = async (challengeId: string) => {
    try {
      await api.post<{ success: boolean }>(`/challenges/${challengeId}/accept`);
      fetchChallenges();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al aceptar');
    }
  };

  const handleDecline = async (challengeId: string) => {
    if (!window.confirm(t('challenges.confirmDecline'))) return;
    try {
      await api.post<{ success: boolean }>(`/challenges/${challengeId}/decline`);
      fetchChallenges();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al rechazar');
    }
  };

  const handlePlay = (challengeId: string) => {
    navigate(`/challenges/${challengeId}/play`);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      await api.post<{ challenge: Challenge }>('/challenges', {
        challengedUsername: createUsername,
        category: createCategory,
      });
      setShowCreateModal(false);
      setCreateUsername('');
      fetchChallenges();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear desafio');
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (challenge: Challenge) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      PENDING: { color: 'bg-yellow-900 text-yellow-300', text: t('challenges.status.pending') },
      ACCEPTED: { color: 'bg-blue-900 text-blue-300', text: t('challenges.status.accepted') },
      COMPLETED: { color: 'bg-green-900 text-green-300', text: t('challenges.status.completed') },
      EXPIRED: { color: 'bg-gray-700 text-gray-400', text: t('challenges.status.expired') },
      DECLINED: { color: 'bg-red-900 text-red-300', text: t('challenges.status.declined') },
    };

    const config = statusConfig[challenge.status];
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const getResultText = (challenge: Challenge) => {
    if (challenge.status !== 'COMPLETED') return null;

    if (challenge.winnerId === user?.id) {
      return <span className="text-green-400 font-bold">{t('challenges.won')}</span>;
    }
    if (challenge.winnerId === null) {
      return <span className="text-yellow-400 font-bold">{t('challenges.tie')}</span>;
    }
    return <span className="text-red-400 font-bold">{t('challenges.lost')}</span>;
  };

  const canPlay = (challenge: Challenge) => {
    if (challenge.status !== 'ACCEPTED') return false;
    const isChallenger = challenge.challenger.id === user?.id;
    return isChallenger ? challenge.challengerScore === null : challenge.challengedScore === null;
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
            📨 {t('challenges.title')}
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors text-sm"
          >
            + {t('challenges.create')}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-gray-800/50 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1">
            {(['received', 'sent', 'completed'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'text-primary border-primary'
                    : 'text-gray-400 border-transparent hover:text-white'
                }`}
              >
                {t(`challenges.tabs.${tab}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredChallenges.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-400">{t('challenges.empty')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredChallenges.map((challenge) => {
              const opponent =
                challenge.challenger.id === user?.id
                  ? challenge.challenged
                  : challenge.challenger;
              const isReceived = challenge.challenged.id === user?.id;

              return (
                <div
                  key={challenge.id}
                  className="bg-gray-800 rounded-xl p-4 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-lg font-bold">
                        {opponent.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {isReceived ? t('challenges.from') : t('challenges.to')}{' '}
                          {opponent.username}
                        </div>
                        <div className="text-sm text-gray-400">
                          {challenge.category || 'MIXED'} •{' '}
                          {new Date(challenge.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(challenge)}
                      {getResultText(challenge)}
                    </div>
                  </div>

                  {/* Scores (if completed) */}
                  {challenge.status === 'COMPLETED' && (
                    <div className="flex justify-center gap-8 py-3 bg-gray-900 rounded-lg mb-3">
                      <div className="text-center">
                        <div className="text-xl font-bold text-primary">
                          {challenge.challenger.id === user?.id
                            ? challenge.challengerScore
                            : challenge.challengedScore}
                        </div>
                        <div className="text-xs text-gray-400">{t('challenges.yourScore')}</div>
                      </div>
                      <div className="text-gray-500">vs</div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-white">
                          {challenge.challenger.id === user?.id
                            ? challenge.challengedScore
                            : challenge.challengerScore}
                        </div>
                        <div className="text-xs text-gray-400">{opponent.username}</div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {challenge.status === 'PENDING' && isReceived && (
                      <>
                        <button
                          onClick={() => handleAccept(challenge.id)}
                          className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          {t('challenges.accept')}
                        </button>
                        <button
                          onClick={() => handleDecline(challenge.id)}
                          className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          {t('challenges.decline')}
                        </button>
                      </>
                    )}
                    {canPlay(challenge) && (
                      <button
                        onClick={() => handlePlay(challenge.id)}
                        className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
                      >
                        {t('challenges.play')}
                      </button>
                    )}
                    {challenge.status === 'ACCEPTED' && !canPlay(challenge) && (
                      <div className="flex-1 py-2 text-center text-gray-400">
                        {t('challenges.waitingOpponent')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">
              {t('challenges.createTitle')}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-300 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('challenges.opponentUsername')}
                </label>
                <input
                  type="text"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary"
                  placeholder={t('challenges.usernamePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('challenges.category')}
                </label>
                <select
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary"
                >
                  <option value="MIXED">{t('categories.mixed')}</option>
                  <option value="FLAG">{t('categories.flags')}</option>
                  <option value="CAPITAL">{t('categories.capitals')}</option>
                  <option value="MAP">{t('categories.maps')}</option>
                  <option value="SILHOUETTE">{t('categories.silhouettes')}</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50"
                >
                  {creating ? <LoadingSpinner size="sm" /> : t('challenges.send')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
