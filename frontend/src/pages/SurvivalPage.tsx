import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socket';
import { LoadingSpinner, GameRoundScaffold, RoundActionTray, Timer } from '../components';
import { Button } from '../components';
import { MonumentAttribution } from '../components/MonumentAttribution';
import {
  Category,
  Difficulty,
  Question,
  SurvivalPlayerInfo,
  SurvivalPlayerResult,
  SurvivalRanking,
} from '../types';
import { useHaptics, useImagePreloader } from '../hooks';
import { toAppPath } from '../utils/routing';

const MapInteractive = lazy(() =>
  import('../components/MapInteractive').then((m) => ({ default: m.MapInteractive }))
);

const SURVIVAL_CATEGORIES: Category[] = ['FLAG', 'CAPITAL', 'MAP', 'SILHOUETTE', 'MONUMENT', 'MOVIE_SCENE', 'MIXED'];
const MAX_LIVES = 4;
const SEARCH_TIMEOUT_SECONDS = 120;

type PageStatus =
  | 'idle'
  | 'queued'
  | 'filling'
  | 'countdown'
  | 'playing'
  | 'spectating'
  | 'finished';

function parseSurvivalCategory(value: string | null): Category {
  if (!value) return 'MIXED';
  return SURVIVAL_CATEGORIES.includes(value as Category) ? (value as Category) : 'MIXED';
}

function getDifficultyColor(diff: Difficulty | null): string {
  if (diff === 'EASY') return 'text-green-400 border-green-700 bg-green-950';
  if (diff === 'MEDIUM') return 'text-yellow-400 border-yellow-700 bg-yellow-950';
  if (diff === 'HARD') return 'text-red-400 border-red-700 bg-red-950';
  return 'text-app-subtle border-app-border bg-app-surface';
}

function LivesDisplay({ lives, max = MAX_LIVES }: { lives: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5 text-sm">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < lives ? 'text-red-500' : 'text-gray-700'}>
          ♥
        </span>
      ))}
    </span>
  );
}

function PlayerCard({
  player,
  isMe,
  answered,
}: {
  player: SurvivalPlayerInfo;
  isMe: boolean;
  answered: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 transition-all ${
        player.eliminated
          ? 'border-app-border bg-app-surface/30 opacity-40'
          : answered
          ? 'border-green-700/50 bg-green-950/20'
          : isMe
          ? 'border-primary/60 bg-primary/10'
          : 'border-app-border bg-app-surface/60'
      }`}
    >
      <span className="max-w-[5rem] truncate text-xs font-semibold text-app-text">
        {player.username}
        {isMe && <span className="text-primary"> ★</span>}
      </span>
      <LivesDisplay lives={player.eliminated ? 0 : player.lives} />
      <span className="text-xs text-app-subtle">{player.score}</span>
    </div>
  );
}

export function SurvivalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const haptics = useHaptics();

  const category = parseSurvivalCategory(searchParams.get('category'));

  const [status, setStatus] = useState<PageStatus>('idle');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [players, setPlayers] = useState<SurvivalPlayerInfo[]>([]);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [fillTimeRemaining, setFillTimeRemaining] = useState(15);
  const [countdown, setCountdown] = useState(3);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [timeLimit, setTimeLimit] = useState(15);
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answeredPlayers, setAnsweredPlayers] = useState<Set<string>>(new Set());
  const [rankings, setRankings] = useState<SurvivalRanking[]>([]);
  const [totalRounds, setTotalRounds] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  const [searchTimedOut, setSearchTimedOut] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lifeGainedNotice, setLifeGainedNotice] = useState<string | null>(null);
  const [myLastAnswerCorrect, setMyLastAnswerCorrect] = useState(false);
  const [survivalImageUrls, setSurvivalImageUrls] = useState<string[]>([]);
  useImagePreloader(survivalImageUrls, 0); // skip=0: aún no hay ninguna imagen mostrándose

  const fillTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAnsweredRef = useRef(false);
  const answerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasSubmittedThisRound, setHasSubmittedThisRound] = useState(false);

  // ── Socket events ──────────────────────────────────────────────────────────

  useEffect(() => {
    socketService.connect();
    const socket = socketService.socket;
    if (!socket) return;

    socket.emit('survival:resume');

    socket.on('survival:queued', () => {
      setStatus('queued');
    });

    socket.on('survival:matched', (data: {
      matchId: string;
      category: Category;
      fillTimeRemaining: number;
      maxPlayers: number;
      players: SurvivalPlayerInfo[];
      imageUrls?: string[];
    }) => {
      setMatchId(data.matchId);
      setMaxPlayers(data.maxPlayers);
      setFillTimeRemaining(data.fillTimeRemaining);
      setPlayers(data.players);
      if (data.imageUrls?.length) {
        setSurvivalImageUrls(data.imageUrls);
      }
      setStatus('filling');

      if (fillTimerRef.current) clearInterval(fillTimerRef.current);
      let remaining = data.fillTimeRemaining;
      fillTimerRef.current = setInterval(() => {
        remaining--;
        setFillTimeRemaining(Math.max(0, remaining));
        if (remaining <= 0 && fillTimerRef.current) {
          clearInterval(fillTimerRef.current);
          fillTimerRef.current = null;
        }
      }, 1000);
    });

    socket.on('survival:player-joined', (data: { player: SurvivalPlayerInfo }) => {
      setPlayers((prev) => {
        if (prev.some((p) => p.userId === data.player.userId)) return prev;
        return [...prev, data.player];
      });
    });

    socket.on('survival:player-left', (data: { userId: string }) => {
      setPlayers((prev) => prev.filter((p) => p.userId !== data.userId));
    });

    socket.on('survival:cancelled', () => {
      if (fillTimerRef.current) { clearInterval(fillTimerRef.current); fillTimerRef.current = null; }
      setStatus('idle');
      setMatchId(null);
      setPlayers([]);
      setNotice(t('survival.cancelledNotEnoughPlayers'));
    });

    socket.on('survival:countdown', (data: { seconds: number }) => {
      if (fillTimerRef.current) { clearInterval(fillTimerRef.current); fillTimerRef.current = null; }
      setStatus('countdown');
      setCountdown(data.seconds);
    });

    socket.on('survival:question', (data: {
      round: number;
      question: Question;
      difficulty: Difficulty;
      timeLimit: number;
      players: SurvivalPlayerInfo[];
    }) => {
      setStatus('playing');
      setCurrentRound(data.round);
      setCurrentQuestion(data.question);
      setDifficulty(data.difficulty);
      setTimeLimit(data.timeLimit);
      setTimeRemaining(data.timeLimit);
      setShowResult(false);
      setAnsweredPlayers(new Set());
      setSelectedAnswer(null);
      setMapLocation(null);
      setLifeGainedNotice(null);
      setMyLastAnswerCorrect(false);
      if (answerDebounceRef.current) {
        clearTimeout(answerDebounceRef.current);
        answerDebounceRef.current = null;
      }
      hasAnsweredRef.current = false;
      setHasSubmittedThisRound(false);
      setPlayers(data.players);
    });

    socket.on('survival:player-answered', (data: { userId: string }) => {
      setAnsweredPlayers((prev) => new Set([...prev, data.userId]));
    });

    socket.on('survival:question-result', (data: {
      round: number;
      correctAnswer: string;
      playerResults: SurvivalPlayerResult[];
      eliminatedThisRound: string[];
    }) => {
      setShowResult(true);

      const myResult = data.playerResults.find((r) => r.userId === user?.id);
      setMyLastAnswerCorrect(myResult?.isCorrect ?? false);

      setPlayers((prev) =>
        prev.map((p) => {
          const result = data.playerResults.find((r) => r.userId === p.userId);
          if (!result) return p;
          return {
            ...p,
            lives: result.newLives,
            score: result.score,
            streak: result.streak,
            eliminated: data.eliminatedThisRound.includes(p.userId) || p.eliminated,
          };
        })
      );

      if (myResult?.lifeEarnedReason) {
        setLifeGainedNotice(t('survival.lifeEarnedStreak'));
        haptics.success();
      } else if (myResult?.isCorrect) {
        haptics.success();
      } else {
        haptics.error();
      }

      if (data.eliminatedThisRound.includes(user?.id ?? '')) {
        setTimeout(() => setStatus('spectating'), 1800);
      }
    });

    socket.on('survival:player-disconnected', () => {
      setNotice(t('survival.playerDisconnected'));
    });

    socket.on('survival:player-reconnected', () => {
      setNotice(null);
    });

    socket.on('survival:state', (data: {
      matchId: string;
      status: string;
      round: number;
      difficulty: Difficulty;
      timeLimit: number;
      players: SurvivalPlayerInfo[];
      currentQuestion: Question | null;
    }) => {
      setMatchId(data.matchId);
      setCurrentRound(data.round);
      setDifficulty(data.difficulty);
      setTimeLimit(data.timeLimit);
      setTimeRemaining(data.timeLimit);
      setPlayers(data.players);
      if (data.currentQuestion) setCurrentQuestion(data.currentQuestion);
      const myPlayer = data.players.find((p) => p.userId === user?.id);
      if (myPlayer?.eliminated) setStatus('spectating');
      else if (data.status === 'playing') setStatus('playing');
    });

    socket.on('survival:finished', (data: {
      reason: string;
      rankings: SurvivalRanking[];
      totalRounds: number;
    }) => {
      setRankings(data.rankings);
      setTotalRounds(data.totalRounds);
      setStatus('finished');
      const myRanking = data.rankings.find((r) => r.userId === user?.id);
      if (myRanking?.finalRank === 1) haptics.celebrate();
      else haptics.error();
    });

    socket.on('survival:error', (data: { message: string }) => {
      setNotice(data.message);
    });

    socket.on('survival:dequeued', () => {
      setStatus('idle');
    });

    return () => {
      socket.off('survival:queued');
      socket.off('survival:matched');
      socket.off('survival:player-joined');
      socket.off('survival:player-left');
      socket.off('survival:cancelled');
      socket.off('survival:countdown');
      socket.off('survival:question');
      socket.off('survival:player-answered');
      socket.off('survival:question-result');
      socket.off('survival:player-disconnected');
      socket.off('survival:player-reconnected');
      socket.off('survival:state');
      socket.off('survival:finished');
      socket.off('survival:error');
      socket.off('survival:dequeued');
      if (answerDebounceRef.current) clearTimeout(answerDebounceRef.current);
    };
  }, [t, user?.id, haptics]);

  // Search timer
  useEffect(() => {
    if (status !== 'queued') {
      if (searchTimerRef.current) { clearInterval(searchTimerRef.current); searchTimerRef.current = null; }
      if (status === 'idle') { setSearchTime(0); setSearchTimedOut(false); }
      return;
    }
    searchTimerRef.current = setInterval(() => {
      setSearchTime((prev) => {
        const next = prev + 1;
        if (next >= SEARCH_TIMEOUT_SECONDS) {
          setSearchTimedOut(true);
          if (searchTimerRef.current) { clearInterval(searchTimerRef.current); searchTimerRef.current = null; }
        }
        return next;
      });
    }, 1000);
    return () => {
      if (searchTimerRef.current) { clearInterval(searchTimerRef.current); searchTimerRef.current = null; }
    };
  }, [status]);

  useEffect(() => {
    return () => {
      if (fillTimerRef.current) clearInterval(fillTimerRef.current);
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    };
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const joinQueue = useCallback(() => {
    setNotice(null);
    socketService.socket?.emit('survival:queue', { category });
  }, [category]);

  const cancelQueue = useCallback(() => {
    socketService.socket?.emit('survival:dequeue');
    if (fillTimerRef.current) { clearInterval(fillTimerRef.current); fillTimerRef.current = null; }
    setStatus('idle');
    setMatchId(null);
    setPlayers([]);
  }, []);

  const handleLocationSelect = useCallback((lat: number, lng: number) => {
    setMapLocation({ lat, lng });
  }, []);

  // MAP confirm and timer expiry — one-shot, guarded by hasAnsweredRef
  const handleSubmitAnswer = useCallback(() => {
    if (answerDebounceRef.current) {
      clearTimeout(answerDebounceRef.current);
      answerDebounceRef.current = null;
    }
    if (hasAnsweredRef.current || !matchId || !currentQuestion) return;
    const answer = currentQuestion.category === 'MAP' ? 'MAP_ANSWER' : (selectedAnswer ?? '');
    if (!answer && currentQuestion.category !== 'MAP') return;
    if (currentQuestion.category === 'MAP' && !mapLocation) return;

    hasAnsweredRef.current = true;
    setHasSubmittedThisRound(true);
    socketService.socket?.emit('survival:answer', {
      questionId: currentQuestion.id,
      answer,
      timeRemaining,
      coordinates: mapLocation ?? undefined,
    });
  }, [matchId, currentQuestion, selectedAnswer, mapLocation, timeRemaining]);

  // Option selection: debounces 300ms before emitting so a rapid answer change
  // sends only the last-selected option (avoids the processingAnswers lock race).
  const handleOptionSelect = useCallback(
    (option: string) => {
      if (showResult || status === 'spectating') return;
      setSelectedAnswer(option);
      if (currentQuestion?.category !== 'MAP') {
        if (!matchId || !currentQuestion) return;
        if (answerDebounceRef.current) clearTimeout(answerDebounceRef.current);
        const capturedQuestion = currentQuestion;
        const capturedTime = timeRemaining;
        answerDebounceRef.current = setTimeout(() => {
          answerDebounceRef.current = null;
          hasAnsweredRef.current = true;
          setHasSubmittedThisRound(true);
          socketService.socket?.emit('survival:answer', {
            questionId: capturedQuestion.id,
            answer: option,
            timeRemaining: capturedTime,
            coordinates: undefined,
          });
        }, 300);
      }
    },
    [showResult, status, currentQuestion, matchId, timeRemaining]
  );

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderRankBadge(rank: number) {
    if (rank === 1) return <span className="text-2xl">🏆</span>;
    if (rank === 2) return <span className="text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-2xl">🥉</span>;
    return <span className="text-lg text-app-subtle">#{rank}</span>;
  }

  const backButton = (
    <button
      onClick={() => navigate(toAppPath('/menu'))}
      className="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface/80 px-3 py-1.5 text-xs text-app-secondary hover:text-app-text"
    >
      ← {t('survival.backToMenu')}
    </button>
  );

  // ── Screens ────────────────────────────────────────────────────────────────

  if (status === 'idle') {
    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
          <div className="text-6xl">☠️</div>
          <div>
            <h1 className="text-2xl font-bold text-app-text">{t('survival.title')}</h1>
            <p className="mt-1 text-sm text-app-secondary">{t('survival.subtitle')}</p>
          </div>

          <div className="w-full rounded-2xl border border-app-border bg-app-surface p-4 text-left text-sm text-app-text space-y-2">
            {[
              ['❤️', t('survival.ruleOneLive')],
              ['📈', t('survival.ruleDifficulty')],
              ['🔥', t('survival.ruleStreak')],
              ['👑', t('survival.ruleWin')],
            ].map(([icon, text]) => (
              <div key={icon} className="flex items-start gap-2">
                <span>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>

          {notice && <p className="text-sm text-amber-400">{notice}</p>}

          <div className="flex items-center gap-2 text-xs text-app-subtle">
            <span className="rounded border border-green-800 bg-green-950 px-2 py-0.5 text-green-400">
              {t('survival.difficulty.easy')} 15s
            </span>
            <span className="text-app-subtle">→</span>
            <span className="rounded border border-yellow-800 bg-yellow-950 px-2 py-0.5 text-yellow-400">
              {t('survival.difficulty.medium')} 12s
            </span>
            <span className="text-app-subtle">→</span>
            <span className="rounded border border-red-800 bg-red-950 px-2 py-0.5 text-red-400">
              {t('survival.difficulty.hard')} 9s
            </span>
          </div>

          <Button onClick={joinQueue} variant="primary" size="lg" className="w-full">
            {t('survival.findMatch')}
          </Button>
          <button
            onClick={() => navigate(toAppPath('/menu'))}
            className="text-xs text-app-subtle hover:text-app-text"
          >
            ← {t('survival.backToMenu')}
          </button>
        </div>
      </div>
    );
  }

  if (status === 'queued') {
    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex flex-col items-center justify-center px-4 gap-5 text-center">
        <div className="relative inline-flex items-center justify-center">
          <span className="absolute inline-flex h-20 w-20 rounded-full bg-primary/10 animate-ping" />
          <span className="text-5xl relative">☠️</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-app-text">{t('survival.searching')}</h2>
          <p className="mt-1 text-sm text-app-secondary tabular-nums">{searchTime}s</p>
        </div>
        {searchTimedOut && (
          <p className="text-sm text-amber-400">{t('survival.notEnoughPlayers')}</p>
        )}
        <Button onClick={cancelQueue} variant="secondary" size="sm">
          {t('survival.cancel')}
        </Button>
      </div>
    );
  }

  if (status === 'filling') {
    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex flex-col items-center justify-center px-4 gap-5 text-center">
        <div>
          <h2 className="text-xl font-bold text-app-text">{t('survival.roomFound')}</h2>
          <p className="text-sm text-app-secondary">
            {t('survival.waitingForPlayers', { current: players.length, max: maxPlayers })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-app-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000"
              style={{ width: `${Math.max(0, ((15 - fillTimeRemaining) / 15) * 100)}%` }}
            />
          </div>
          <span className="text-sm tabular-nums text-app-secondary">{fillTimeRemaining}s</span>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {players.map((p) => (
            <div
              key={p.userId}
              className={`flex flex-col items-center gap-1 rounded-xl border px-4 py-3 ${
                p.userId === user?.id ? 'border-primary/60 bg-primary/10' : 'border-app-border bg-app-surface'
              }`}
            >
              <span className="text-2xl">👤</span>
              <span className="text-xs text-app-text">{p.username}</span>
              {p.userId === user?.id && (
                <span className="text-xs text-primary">{t('survival.you')}</span>
              )}
            </div>
          ))}
          {Array.from({ length: maxPlayers - players.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-app-border px-4 py-3 opacity-40"
            >
              <span className="text-2xl">❓</span>
              <span className="text-xs text-app-subtle">{t('survival.waiting')}</span>
            </div>
          ))}
        </div>

        <Button onClick={cancelQueue} variant="secondary" size="sm">
          {t('survival.cancel')}
        </Button>
      </div>
    );
  }

  if (status === 'countdown') {
    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-base text-app-secondary">{t('survival.gameStarting')}</h2>
        <div className="text-9xl font-black text-app-text tabular-nums">{countdown}</div>
      </div>
    );
  }

  if (status === 'finished') {
    const myRanking = rankings.find((r) => r.userId === user?.id);
    const isWinner = myRanking?.finalRank === 1;

    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
          <div className="text-5xl">{isWinner ? '🏆' : '💀'}</div>
          <div>
            <h2 className="text-2xl font-bold text-app-text">
              {isWinner ? t('survival.youWon') : t('survival.gameOver')}
            </h2>
            <p className="mt-1 text-sm text-app-secondary">
              {t('survival.survivedRounds', { rounds: totalRounds })}
            </p>
          </div>

          <div className="w-full space-y-2">
            {rankings.map((r) => (
              <div
                key={r.userId}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  r.userId === user?.id
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-app-border bg-app-surface'
                }`}
              >
                <div className="w-8 flex justify-center">{renderRankBadge(r.finalRank)}</div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-semibold text-app-text truncate">
                    {r.username}
                    {r.userId === user?.id && (
                      <span className="ml-1 text-xs text-primary">{t('survival.you')}</span>
                    )}
                  </div>
                  <div className="text-xs text-app-secondary">
                    {r.correctCount} {t('survival.correct')}
                    {r.eliminatedRound != null && (
                      <> · {t('survival.eliminatedRound', { round: r.eliminatedRound })}</>
                    )}
                  </div>
                </div>
                <div className="text-sm font-bold text-app-text shrink-0">{r.score} pts</div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 w-full">
            <Button onClick={joinQueue} variant="primary" className="flex-1">
              {t('survival.playAgain')}
            </Button>
            <Button onClick={() => navigate(toAppPath('/menu'))} variant="secondary" className="flex-1">
              {t('common.backToMenu', t('survival.backToMenu'))}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Playing / Spectating ─────────────────────────────────────────────────────

  if (!currentQuestion) {
    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isSpectating = status === 'spectating';
  const isMapQuestion = currentQuestion.category === 'MAP';
  const difficultyLabel = difficulty ? t(`survival.difficulty.${difficulty.toLowerCase()}`) : '';

  return (
    <GameRoundScaffold
      rootClassName="bg-[var(--color-bg-app)]"
      header={
        <header className="sticky top-0 z-30 border-b border-app-border/80 bg-app-surface/95 px-3 py-2 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            {/* Left: round + difficulty */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-app-subtle">
                {t('survival.round')} {currentRound}
              </span>
              {difficulty && (
                <span
                  className={`rounded border px-1.5 py-0.5 text-xs font-bold ${getDifficultyColor(difficulty)}`}
                >
                  {difficultyLabel}
                </span>
              )}
            </div>

            {/* Center: timer */}
            <Timer
              duration={timeLimit}
              timeRemaining={timeRemaining}
              onTick={setTimeRemaining}
              onComplete={() => {
                if (!hasAnsweredRef.current && !showResult) handleSubmitAnswer();
              }}
              isActive={!showResult && !isSpectating}
            />

            {/* Right: back */}
            {backButton}
          </div>

          {/* Player cards row */}
          <div className="mx-auto mt-2 max-w-4xl">
            {isSpectating && (
              <div className="mb-1.5 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-1 text-center text-xs font-semibold text-red-400">
                💀 {t('survival.youEliminated')}
              </div>
            )}
            {lifeGainedNotice && showResult && (
              <div className="mb-1.5 rounded-lg border border-green-700/50 bg-green-950/30 px-3 py-1 text-center text-xs font-semibold text-green-400">
                ✨ {lifeGainedNotice}
              </div>
            )}
            {notice && (
              <div className="mb-1.5 rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-1 text-center text-xs text-amber-400">
                {notice}
              </div>
            )}
            <div className={`grid gap-1.5 ${players.length <= 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>
              {players.map((p) => (
                <PlayerCard
                  key={p.userId}
                  player={p}
                  isMe={p.userId === user?.id}
                  answered={answeredPlayers.has(p.userId)}
                />
              ))}
            </div>
          </div>
        </header>
      }
      question={currentQuestion}
      questionNumber={currentRound}
      totalQuestions={20}
      isMapQuestion={isMapQuestion}
      mapContent={
        <Suspense fallback={<LoadingSpinner size="lg" />}>
          <MapInteractive
            questionId={currentQuestion.id}
            onLocationSelect={handleLocationSelect}
            selectedLocation={mapLocation}
            correctLocation={
              showResult && currentQuestion.latitude != null
                ? { lat: currentQuestion.latitude, lng: currentQuestion.longitude! }
                : null
            }
            showResult={showResult}
            disabled={showResult || isSpectating}
          />
        </Suspense>
      }
      selectedAnswer={selectedAnswer}
      onOptionSelect={handleOptionSelect}
      showResult={showResult}
      disableOptions={isSpectating || showResult}
      actionTray={
        <RoundActionTray
          mode="duel"
          showResult={showResult}
          canSubmit={isMapQuestion ? Boolean(mapLocation) : false}
          isWaiting={hasSubmittedThisRound}
          autoSubmit={!isMapQuestion}
          submitLabel={t('game.submit', 'Confirmar')}
          selectionAssistiveText={t('game.selectionReadyShortHint', '')}
          waitingLabel={t('survival.waiting')}
          resultLabel={myLastAnswerCorrect ? t('game.correct', '✓ Correcto') : t('game.incorrect', '✗ Incorrecto')}
          resultAttribution={
            currentQuestion.category === 'MONUMENT'
              ? <MonumentAttribution question={currentQuestion} />
              : undefined
          }
          showResultBadge
          isCorrect={myLastAnswerCorrect}
          correctAnswer={showResult && !myLastAnswerCorrect ? currentQuestion.correctAnswer : undefined}
          onSubmit={handleSubmitAnswer}
        />
      }
    />
  );
}
