import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, GeoIcon, Header, PageTemplate } from '../components';
import { api } from '../services/api';
import type {
  CompetitiveLadder,
  CompetitionLeaderboardResponse,
  CompetitionOverview,
  CompetitionLadderSummary,
} from '../types';

const LADDERS: CompetitiveLadder[] = ['CLASSIC', 'GEO_CHALLENGE'];

function formatRating(value: number): string {
  return value.toLocaleString('es-CL');
}

export function CompetitionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<CompetitionOverview | null>(null);
  const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardResponse | null>(null);
  const [activeLadder, setActiveLadder] = useState<CompetitiveLadder>('CLASSIC');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    Promise.all([
      api.getCompetitionOverview(),
      api.getCompetitionLeaderboard(activeLadder),
    ])
      .then(([overviewData, leaderboardData]) => {
        if (!mounted) return;
        setOverview(overviewData);
        setLeaderboard(leaderboardData);
      })
      .catch(() => {
        if (!mounted) return;
        setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeLadder]);

  function startRanked(ladder: CompetitiveLadder) {
    navigate(ladder === 'CLASSIC'
      ? '/duel?rated=1&category=MIXED'
      : '/duel?rated=1&mode=geo-challenge');
  }

  return (
    <PageTemplate
      header={
        <Header
          actions={
            <button
              type="button"
              onClick={() => navigate('/menu')}
              className="rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm font-semibold text-app-secondary hover:text-app-text"
            >
              {t('common.back')}
            </button>
          }
        />
      }
      contentClassName="py-3 pb-6"
    >
      <div className="space-y-5">
        <section>
          <h1 className="text-2xl font-black text-app-text">{t('competition.title')}</h1>
          <p className="mt-1 text-sm text-app-secondary">{t('competition.subtitle')}</p>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            {t('competition.error')}
          </div>
        )}

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase text-app-subtle">{t('competition.ranked')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {LADDERS.map((ladder) => (
              <LadderCard
                key={ladder}
                ladder={ladder}
                summary={overview?.ladders[ladder] ?? null}
                loading={loading}
                onPlay={() => startRanked(ladder)}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase text-app-subtle">{t('competition.leaderboard')}</h2>
            <div className="flex rounded-lg border border-app-border bg-app-surface p-1">
              {LADDERS.map((ladder) => (
                <button
                  key={ladder}
                  type="button"
                  onClick={() => setActiveLadder(ladder)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    activeLadder === ladder
                      ? 'bg-primary text-app-on-accent'
                      : 'text-app-secondary hover:text-app-text'
                  }`}
                >
                  {t(`competition.shortLadders.${ladder}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-app-border bg-app-surface">
            {(leaderboard?.leaderboard.length ?? 0) === 0 ? (
              <p className="p-4 text-sm text-app-secondary">{t('competition.emptyLeaderboard')}</p>
            ) : (
              <div className="divide-y divide-app-border">
                {leaderboard!.leaderboard.map((entry) => (
                  <div key={entry.userId} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-4 py-3">
                    <span className="text-sm font-black text-primary">#{entry.rank}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-app-text">{entry.username}</p>
                      <p className="text-xs text-app-subtle">{t(`competition.tiers.${entry.tier}`)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-app-text">{formatRating(entry.rating)}</p>
                      <p className="text-xs text-app-subtle">{entry.wins} W · {entry.draws} D · {entry.losses} L</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase text-app-subtle">{t('competition.recent')}</h2>
          <div className="rounded-xl border border-app-border bg-app-surface">
            {(overview?.recentMatches.length ?? 0) === 0 ? (
              <p className="p-4 text-sm text-app-secondary">{t('competition.emptyRecent')}</p>
            ) : (
              <div className="divide-y divide-app-border">
                {overview!.recentMatches.map((match) => (
                  <div key={match.duelMatchId} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-4 py-3 text-sm">
                    <span className={match.result === 'win' ? 'text-green-400' : match.result === 'loss' ? 'text-red-400' : 'text-app-subtle'}>
                      {match.result === 'win' ? '✓' : match.result === 'loss' ? '✕' : '—'}
                    </span>
                    <span className="min-w-0 truncate text-app-text">
                      {t('competition.vs', { opponent: match.opponent.username })}
                    </span>
                    <span className={match.ratingDelta >= 0 ? 'font-bold text-green-400' : 'font-bold text-red-400'}>
                      {match.ratingDelta >= 0 ? '+' : ''}{match.ratingDelta} · {formatRating(match.ratingAfter)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase text-app-subtle">{t('competition.other')}</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <CompetitionLink to="/challenges" label={t('menu.compete.challenge')} />
            <CompetitionLink to="/survival" label={t('menu.compete.survival')} />
            <CompetitionLink to="/rankings" label={t('competition.scoreRankings')} />
          </div>
        </section>
      </div>
    </PageTemplate>
  );
}

function LadderCard({
  ladder,
  summary,
  loading,
  onPlay,
}: {
  ladder: CompetitiveLadder;
  summary: CompetitionLadderSummary | null;
  loading: boolean;
  onPlay: () => void;
}) {
  const { t } = useTranslation();
  const fallback: CompetitionLadderSummary = {
    rating: 1000,
    peakRating: 1000,
    gamesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    provisional: true,
    placementGamesRemaining: 5,
    rank: null,
    tier: 'CALIBRATING',
  };
  const data = summary ?? fallback;

  return (
    <article className="rounded-xl border border-app-border bg-app-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-app-text">{t(`competition.ladders.${ladder}`)}</h3>
          <p className="mt-1 text-xs text-app-subtle">{t(`competition.ladderDesc.${ladder}`)}</p>
        </div>
        <GeoIcon name="rank" className="h-7 w-7 text-primary" />
      </div>
      <div className="mt-4">
        <p className="text-3xl font-black text-app-text">{loading ? '...' : formatRating(data.rating)}</p>
        <p className="mt-1 text-sm font-semibold text-primary">{t(`competition.tiers.${data.tier}`)}</p>
        <p className="mt-1 text-xs text-app-secondary">
          {data.provisional
            ? t('competition.placementProgress', { played: data.gamesPlayed, total: 5 })
            : data.rank
              ? `#${data.rank}`
              : t('competition.unranked')}
        </p>
        <p className="mt-2 text-xs text-app-subtle">{data.wins} W · {data.draws} D · {data.losses} L</p>
      </div>
      <Button onClick={onPlay} fullWidth size="md" className="mt-4">
        {t('competition.findMatch')}
      </Button>
    </article>
  );
}

function CompetitionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm font-semibold text-app-text hover:border-primary/60 hover:bg-primary/10"
    >
      {label}
    </Link>
  );
}
