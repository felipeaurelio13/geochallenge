import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hasActiveFilters } from '../types';
import type { GameFilters } from '../types';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useGameFilters } from '../hooks/useGameFilters';
import { LoadingSpinner } from '../components';
import { PageHeader } from '../components/molecules/PageHeader';
import { EmptyState } from '../components/molecules/EmptyState';
import { Alert } from '../components/atoms/Alert';
import { Button } from '../components/atoms/Button';
import { Modal } from '../components/organisms/Modal';

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
  filters?: GameFilters;
}

type TabType = 'mine' | 'joinable' | 'completed';
const categories = ['MIXED', 'FLAG', 'CAPITAL', 'MAP', 'SILHOUETTE', 'MONUMENT', 'MOVIE_SCENE'];
const playerOptions = [2, 3, 4, 5, 6, 7, 8];

function buildFilterSummary(f: GameFilters, t: (key: string) => string): string {
  return [
    f.continent && t(`filters.continents.${f.continent.replace(' ', '_')}`),
    f.isInsular && t('filters.insular'),
    f.isLandlocked && t('filters.landlocked'),
    f.difficulty && t(`filters.difficulties.${f.difficulty}`),
  ].filter(Boolean).join(' · ');
}

const categoryKeyByValue: Record<string, string> = {
  MIXED: 'mixed',
  FLAG: 'flags',
  CAPITAL: 'capitals',
  MAP: 'maps',
  SILHOUETTE: 'silhouettes',
  MONUMENT: 'monuments',
  MOVIE_SCENE: 'movieScenes',
};

export function ChallengesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { filters: savedFilters } = useGameFilters();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('mine');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCategories, setCreateCategories] = useState<string[]>(['MIXED']);
  const [createMaxPlayers, setCreateMaxPlayers] = useState(2);
  const [createTime, setCreateTime] = useState<10 | 20 | 30>(20);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const challengeFilters = useMemo<GameFilters>(() => {
    const f: GameFilters = { ...savedFilters };
    const continent = searchParams.get('continent');
    const difficulty = searchParams.get('difficulty');
    if (continent) f.continent = continent;
    if (searchParams.get('isInsular') === 'true') f.isInsular = true;
    if (searchParams.get('isLandlocked') === 'true') f.isLandlocked = true;
    if (difficulty === 'EASY' || difficulty === 'MEDIUM' || difficulty === 'HARD') f.difficulty = difficulty;
    return f;
  }, [searchParams, savedFilters]);

  useEffect(() => {
    const requestedCategory = searchParams.get('category');
    const shouldOpenCreate = searchParams.get('openCreate') === '1';

    if (requestedCategory && categories.includes(requestedCategory)) {
      setCreateCategories([requestedCategory]);
    }

    if (shouldOpenCreate) {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  const fetchChallenges = async () => {
    try {
      setLoading(true);
      setFetchError('');
      const response = await api.get<{ challenges: Challenge[] }>('/challenges');
      setChallenges(response.challenges);
    } catch (err) {
      console.error('Failed to fetch challenges:', err);
      setFetchError(t('challenges.fetchError'));
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
        ...(Object.keys(challengeFilters).length > 0 && { filters: challengeFilters }),
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
    const isReady = challenge.status === 'ACCEPTED' || (challenge.status === 'PENDING' && challenge.participantsCount >= challenge.maxPlayers);
    if (!isReady || !challenge.isUserParticipant) return false;
    const me = challenge.participants.find((p) => p.userId === user?.id);
    return me?.score === null;
  };

  const canShowWaiting = (challenge: Challenge) => (
    challenge.status === 'PENDING' && challenge.isUserParticipant && challenge.participantsCount < challenge.maxPlayers
  );

  const getStatusLabel = (status: Challenge['status']) => t(`challenges.status.${status.toLowerCase()}`);
  const getCategoryLabel = (category: string) => t(`categories.${categoryKeyByValue[category] ?? 'mixed'}`);

  return (
    <div className="h-full min-h-0 bg-[var(--color-bg-app)]">
      <PageHeader
        title={t('challenges.title')}
        backTo="/menu"
        backLabel={`← ${t('common.back')}`}
        sticky
        actions={
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            + {t('challenges.create')}
          </Button>
        }
      />

      <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-2 py-2 text-sm">
          {(['mine', 'joinable', 'completed'] as TabType[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`py-2 rounded-lg ${activeTab === tab ? 'bg-primary text-white' : 'text-[var(--color-text-muted)] bg-[var(--color-surface-muted)]'}`}>
              {t(`challenges.tabs.${tab}`)}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {fetchError && <Alert type="error">{fetchError}</Alert>}
        <section className="rounded-xl border border-primary/30 bg-primary/10 p-4">
          <p className="text-sm font-semibold text-primary">{t('challenges.createMultiplayerTitle')}</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)] sm:text-sm">{t('challenges.createMultiplayerHint')}</p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 sm:w-auto"
            fullWidth
          >
            {t('challenges.createMultiplayerCta')}
          </Button>
        </section>

        {loading ? <LoadingSpinner size="lg" /> : filteredChallenges.length === 0 ? (
          <EmptyState
            message={t('challenges.empty')}
            action={
              <Button
                onClick={() => setShowCreateModal(true)}
                className="mt-4"
              >
                {t('challenges.createMultiplayerCta')}
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredChallenges.map((challenge) => {
              const availableSlots = challenge.maxPlayers - challenge.participantsCount;
              const creatorLabel = `${t('challenges.from')} ${challenge.creator.username}`;

              return (
                <article key={challenge.id} className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-app-text">{creatorLabel}</h3>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {challenge.categories.map(getCategoryLabel).join(', ')} · {challenge.participantsCount}/{challenge.maxPlayers} · {challenge.answerTimeSeconds}s
                      </p>
                      {challenge.filters && hasActiveFilters(challenge.filters) && (
                        <p className="text-xs text-primary/70 mt-0.5">
                          {buildFilterSummary(challenge.filters, t)}
                        </p>
                      )}
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {challenge.isJoinable
                          ? t('challenges.availableSlots', { count: availableSlots })
                          : t('challenges.fullLobby')}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]">{getStatusLabel(challenge.status)}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {challenge.participants.map((p) => (
                      <span key={p.userId} className="px-2 py-1 rounded bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]">
                        {p.user.username}: {p.score ?? '-'}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex gap-2">
                    {challenge.isJoinable && (
                      <Button onClick={() => handleJoin(challenge.id)} size="sm" className="flex-1">{t('challenges.join')}</Button>
                    )}
                    {canPlay(challenge) && (
                      <Button onClick={() => handlePlay(challenge.id)} size="sm" className="flex-1">
                        {t('challenges.play')}
                      </Button>
                    )}
                    {canShowWaiting(challenge) && (
                      <Button variant="secondary" size="sm" disabled className="flex-1">
                        {t('challenges.waitingReady')}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <Modal.Root isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <Modal.Panel>
          <Modal.Title>{t('challenges.createTitle')}</Modal.Title>
          {error && <Alert type="error">{error}</Alert>}
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div>
              <label className="text-sm text-[var(--color-text-secondary)] block mb-2">{t('challenges.categories')}</label>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">{t('challenges.categoriesHint')}</p>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={`px-2 py-2 rounded-lg text-sm border ${createCategories.includes(category) ? 'bg-primary/20 border-primary text-primary' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}
                  >
                    {getCategoryLabel(category)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-[var(--color-text-secondary)] block mb-2">{t('challenges.maxPlayers')}</label>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">{t('challenges.maxPlayersHint')}</p>
              <div className="grid grid-cols-4 gap-2">
                {playerOptions.map((playerCount) => (
                  <button
                    key={playerCount}
                    type="button"
                    onClick={() => setCreateMaxPlayers(playerCount)}
                    className={`py-2 rounded-lg text-sm ${createMaxPlayers === playerCount ? 'bg-primary text-white' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]'}`}
                  >
                    {playerCount}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-[var(--color-text-secondary)] block mb-2">{t('challenges.answerTime')}</label>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">{t('challenges.answerTimeHint')}</p>
              <div className="grid grid-cols-3 gap-2">
                {[10, 20, 30].map((time) => (
                  <button key={time} type="button" onClick={() => setCreateTime(time as 10 | 20 | 30)} className={`py-2 rounded-lg ${createTime === time ? 'bg-primary text-white' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]'}`}>
                    {time}s
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-text-secondary)]">
              {t('challenges.summary', {
                categories: createCategories.map(getCategoryLabel).join(', '),
                maxPlayers: createMaxPlayers,
                answerTimeSeconds: createTime,
              })}
            </div>

            {hasActiveFilters(challengeFilters) && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                {t('challenges.activeFilters', {
                  summary: buildFilterSummary(challengeFilters, t),
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={creating} fullWidth>{creating ? t('common.loading') : t('challenges.send')}</Button>
              <Modal.CloseButton>{t('common.cancel')}</Modal.CloseButton>
            </div>
          </form>
        </Modal.Panel>
      </Modal.Root>
    </div>
  );
}
