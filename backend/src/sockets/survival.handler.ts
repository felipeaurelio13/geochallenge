import { Server as SocketIOServer, Socket } from 'socket.io';
import { Category, Difficulty, GameMode } from '@prisma/client';
import {
  getQuestionsForGame,
  validateAnswer,
  saveGameResult,
  AnswerResult,
  GameQuestion,
  QuestionFilters,
} from '../services/game.service.js';
import { updateLeaderboardScore, updateSeasonLeaderboardScore } from '../services/leaderboard.service.js';
import { prisma } from '../config/database.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;
const MAX_LIVES = 4;
const STARTING_LIVES = 2;
const STREAK_FOR_LIFE = 4;
const FILL_WINDOW_MS = 15_000;
const COUNTDOWN_SECONDS = 3;
const QUESTION_RESULT_DELAY_MS = 3_000;
const DISCONNECT_GRACE_MS = 20_000;

const TIME_PER_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 15,
  MEDIUM: 12,
  HARD: 9,
};

// Questions fetched per phase upfront
const PHASE_FETCH_COUNTS = { EASY: 5, MEDIUM: 5, HARD: 15 };

const SURVIVAL_CATEGORIES: Category[] = ['MAP', 'FLAG', 'CAPITAL', 'SILHOUETTE', 'MONUMENT', 'CINEMA_GEO', 'MIXED'];

function getDifficultyForRound(round: number): Difficulty {
  if (round <= 5) return 'EASY';
  if (round <= 10) return 'MEDIUM';
  return 'HARD';
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueuedPlayer {
  userId: string;
  username: string;
  socketId: string;
  category: Category;
}

interface SurvivalPlayer {
  userId: string;
  username: string;
  socketId: string;
  lives: number;
  streak: number;
  livesEarned: number;
  score: number;
  correctCount: number;
  answers: (AnswerResult | null)[];
  eliminated: boolean;
  eliminatedRound: number | null;
  finalRank: number | null;
  pendingRound?: number;
}

interface ActiveSurvivalMatch {
  id: string;
  status: 'filling' | 'countdown' | 'playing' | 'finished';
  players: SurvivalPlayer[];
  category: Category;
  questions: GameQuestion[];
  usedQuestionIds: string[];
  currentRound: number;
  resolvingRound?: number;
  fillTimerId?: ReturnType<typeof setTimeout>;
  fillStartedAt: number;
  countdownIntervalId?: ReturnType<typeof setInterval>;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
}

// ─── Global state ────────────────────────────────────────────────────────────

const activeMatches = new Map<string, ActiveSurvivalMatch>();
const playerMatches = new Map<string, string>();
const pendingQueue: QueuedPlayer[] = [];
const processingAnswers = new Set<string>();

const eventCounts = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(socketId: string, event: string, max = 30): boolean {
  const key = `${socketId}:${event}`;
  const now = Date.now();
  const entry = eventCounts.get(key);
  if (!entry || now > entry.resetAt) {
    eventCounts.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

function generateMatchId(): string {
  return `survival_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function normalizeCategory(cat?: Category): Category {
  return cat && SURVIVAL_CATEGORIES.includes(cat) ? cat : 'MIXED';
}

function getActivePlayers(match: ActiveSurvivalMatch): SurvivalPlayer[] {
  return match.players.filter((p) => !p.eliminated);
}

// ─── Match lifecycle ──────────────────────────────────────────────────────────

async function createMatch(
  io: SocketIOServer,
  players: QueuedPlayer[],
  category: Category
): Promise<void> {
  const matchId = generateMatchId();

  const easyQs = await getQuestionsForGame(category, PHASE_FETCH_COUNTS.EASY, [], {
    difficulty: 'EASY',
  } as QuestionFilters);
  const usedAfterEasy = easyQs.map((q) => q.id);

  const mediumQs = await getQuestionsForGame(category, PHASE_FETCH_COUNTS.MEDIUM, usedAfterEasy, {
    difficulty: 'MEDIUM',
  } as QuestionFilters);
  const usedAfterMedium = [...usedAfterEasy, ...mediumQs.map((q) => q.id)];

  const hardQs = await getQuestionsForGame(category, PHASE_FETCH_COUNTS.HARD, usedAfterMedium, {
    difficulty: 'HARD',
  } as QuestionFilters);

  const allQuestions = [...easyQs, ...mediumQs, ...hardQs];
  const usedIds = allQuestions.map((q) => q.id);

  const match: ActiveSurvivalMatch = {
    id: matchId,
    status: 'filling',
    category,
    players: players.map((p) => ({
      userId: p.userId,
      username: p.username,
      socketId: p.socketId,
      lives: STARTING_LIVES,
      streak: 0,
      livesEarned: 0,
      score: 0,
      correctCount: 0,
      answers: [],
      eliminated: false,
      eliminatedRound: null,
      finalRank: null,
    })),
    questions: allQuestions,
    usedQuestionIds: usedIds,
    currentRound: 1,
    fillStartedAt: Date.now(),
    disconnectTimers: new Map(),
  };

  activeMatches.set(matchId, match);

  for (const p of players) {
    playerMatches.set(p.userId, matchId);
    io.sockets.sockets.get(p.socketId)?.join(matchId);
  }

  io.to(matchId).emit('survival:matched', {
    matchId,
    category,
    fillTimeRemaining: FILL_WINDOW_MS / 1000,
    maxPlayers: MAX_PLAYERS,
    players: match.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      lives: p.lives,
    })),
    imageUrls: allQuestions.map((q) => q.imageUrl).filter((url): url is string => !!url),
  });

  match.fillTimerId = setTimeout(async () => {
    const m = activeMatches.get(matchId);
    if (!m || m.status !== 'filling') return;
    m.fillTimerId = undefined;
    await startCountdown(io, m);
  }, FILL_WINDOW_MS);
}

async function startCountdown(io: SocketIOServer, match: ActiveSurvivalMatch): Promise<void> {
  if (match.status !== 'filling') return;

  if (getActivePlayers(match).length < MIN_PLAYERS) {
    io.to(match.id).emit('survival:cancelled', { reason: 'not_enough_players' });
    cleanupMatch(match.id);
    return;
  }

  match.status = 'countdown';
  let seconds = COUNTDOWN_SECONDS;
  io.to(match.id).emit('survival:countdown', { seconds });

  match.countdownIntervalId = setInterval(() => {
    seconds--;
    const m = activeMatches.get(match.id);
    if (!m || m.status !== 'countdown') {
      clearInterval(match.countdownIntervalId);
      return;
    }
    if (seconds > 0) {
      io.to(m.id).emit('survival:countdown', { seconds });
    } else {
      clearInterval(m.countdownIntervalId);
      m.countdownIntervalId = undefined;
      startGame(io, m);
    }
  }, 1000);
}

function startGame(io: SocketIOServer, match: ActiveSurvivalMatch): void {
  match.status = 'playing';
  match.currentRound = 1;
  sendQuestion(io, match);
}

function sendQuestion(io: SocketIOServer, match: ActiveSurvivalMatch): void {
  const round = match.currentRound;
  const question = match.questions[round - 1];

  if (!question) {
    endGame(io, match, 'completed');
    return;
  }

  const difficulty = getDifficultyForRound(round);
  const timeLimit = TIME_PER_DIFFICULTY[difficulty];

  io.to(match.id).emit('survival:question', {
    round,
    question,
    difficulty,
    timeLimit,
    players: getActivePlayers(match).map((p) => ({
      userId: p.userId,
      username: p.username,
      lives: p.lives,
      streak: p.streak,
      score: p.score,
    })),
  });

  // Auto-close when timer expires
  setTimeout(() => {
    const m = activeMatches.get(match.id);
    if (!m || m.status !== 'playing' || m.currentRound !== round || m.resolvingRound === round) return;

    for (const player of getActivePlayers(m)) {
      // Skip players with a re-submission in flight (pendingRound set)
      if (player.answers.length < round && player.pendingRound !== round) {
        player.pendingRound = undefined;
        player.answers.push(null);
      }
    }
    resolveRound(io, m, round);
  }, (timeLimit + 2) * 1000);
}

function resolveRound(io: SocketIOServer, match: ActiveSurvivalMatch, round: number): void {
  if (
    match.status !== 'playing' ||
    match.currentRound !== round ||
    match.resolvingRound === round
  ) return;
  match.resolvingRound = round;

  const question = match.questions[round - 1];
  const difficulty = getDifficultyForRound(round);
  const eliminatedThisRound: string[] = [];

  const playerResults = getActivePlayers(match).map((player) => {
    const answer = player.answers[round - 1];
    const isCorrect = answer !== null && answer !== undefined && answer.isCorrect;

    let livesChange = 0;
    let lifeEarnedReason: string | undefined;

    if (isCorrect) {
      player.correctCount++;
      player.streak++;
      player.score += answer!.points;

      if (player.streak >= STREAK_FOR_LIFE) {
        const before = player.lives;
        player.lives = Math.min(player.lives + 1, MAX_LIVES);
        livesChange = player.lives - before;
        player.livesEarned += livesChange;
        if (livesChange > 0) lifeEarnedReason = 'streak';
      }
    } else {
      player.streak = 0;
      player.lives = Math.max(0, player.lives - 1);
      livesChange = -1;
      if (player.lives <= 0) {
        eliminatedThisRound.push(player.userId);
      }
    }

    return {
      userId: player.userId,
      username: player.username,
      isCorrect,
      isTimeout: answer === null,
      livesChange,
      newLives: player.lives,
      lifeEarnedReason,
      eliminatedThisRound: eliminatedThisRound.includes(player.userId),
      score: player.score,
      streak: player.streak,
    };
  });

  // Assign rank to eliminated players
  // activePlayers after elimination = current active minus those eliminated now
  const activeAfter = match.players.filter(
    (p) => !p.eliminated && !eliminatedThisRound.includes(p.userId)
  );
  const rankForEliminated = activeAfter.length + 1;

  for (const userId of eliminatedThisRound) {
    const player = match.players.find((p) => p.userId === userId)!;
    player.eliminated = true;
    player.eliminatedRound = round;
    player.finalRank = rankForEliminated;
  }

  io.to(match.id).emit('survival:question-result', {
    round,
    correctAnswer: question?.correctAnswer ?? '',
    playerResults,
    eliminatedThisRound,
  });

  setTimeout(() => {
    const m = activeMatches.get(match.id);
    if (!m || m.status !== 'playing' || m.currentRound !== round) return;
    m.resolvingRound = undefined;

    const remaining = getActivePlayers(m);

    if (remaining.length <= 1) {
      if (remaining.length === 1) remaining[0].finalRank = 1;
      endGame(io, m, 'completed');
    } else {
      m.currentRound++;
      sendQuestion(io, m);
    }
  }, QUESTION_RESULT_DELAY_MS);
}

async function endGame(
  io: SocketIOServer,
  match: ActiveSurvivalMatch,
  reason: string
): Promise<void> {
  if (match.status === 'finished') return;
  match.status = 'finished';

  // Rank remaining active players by score: highest score gets rank 1
  const remaining = getActivePlayers(match);
  remaining
    .sort((a, b) => b.score - a.score)
    .forEach((p, i) => { p.finalRank = i + 1; });

  const rankings = [...match.players]
    .sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99) || b.score - a.score)
    .map((p) => ({
      userId: p.userId,
      username: p.username,
      finalRank: p.finalRank ?? match.players.length,
      score: p.score,
      correctCount: p.correctCount,
      eliminatedRound: p.eliminatedRound,
    }));

  io.to(match.id).emit('survival:finished', {
    reason,
    rankings,
    totalRounds: match.currentRound,
  });

  // Capture data before cleanup
  const matchSnapshot = {
    id: match.id,
    category: match.category,
    totalRounds: match.currentRound,
    peakPlayers: match.players.length,
    players: match.players.map((p) => ({
      userId: p.userId,
      answers: p.answers.filter((a): a is AnswerResult => a !== null),
      finalRank: p.finalRank ?? match.players.length,
      eliminatedRound: p.eliminatedRound,
      finalScore: p.score,
      correctCount: p.correctCount,
      livesEarned: p.livesEarned,
    })),
  };

  cleanupMatch(match.id);

  try {
    await prisma.survivalMatch.create({
      data: {
        id: matchSnapshot.id,
        category: matchSnapshot.category || null,
        totalRounds: matchSnapshot.totalRounds,
        peakPlayers: matchSnapshot.peakPlayers,
        participants: {
          create: matchSnapshot.players.map((p) => ({
            userId: p.userId,
            finalRank: p.finalRank,
            eliminatedRound: p.eliminatedRound,
            finalScore: p.finalScore,
            correctCount: p.correctCount,
            livesEarned: p.livesEarned,
          })),
        },
      },
    });

    for (const p of matchSnapshot.players) {
      await saveGameResult(p.userId, p.answers, matchSnapshot.category, GameMode.SURVIVAL);
      await updateLeaderboardScore(p.userId, p.finalScore).catch(() => {});
      await updateSeasonLeaderboardScore(p.userId, p.finalScore).catch(() => {});
    }
  } catch (err) {
    console.error(`[survival] Error saving results for ${matchSnapshot.id}:`, err);
  }
}

function cleanupMatch(matchId: string): void {
  const match = activeMatches.get(matchId);
  if (!match) return;

  if (match.fillTimerId) clearTimeout(match.fillTimerId);
  if (match.countdownIntervalId) clearInterval(match.countdownIntervalId);
  for (const timer of match.disconnectTimers.values()) clearTimeout(timer);

  for (const p of match.players) playerMatches.delete(p.userId);
  activeMatches.delete(matchId);
}

// ─── Handler setup ────────────────────────────────────────────────────────────

export function setupSurvivalHandlers(io: SocketIOServer, socket: Socket): void {
  const user = socket.user!;

  socket.on('survival:queue', async (data?: { category?: Category }) => {
    if (isRateLimited(socket.id, 'survival:queue', 10)) {
      socket.emit('survival:error', { message: 'Demasiadas solicitudes' });
      return;
    }

    const existingMatchId = playerMatches.get(user.userId);
    if (existingMatchId) {
      const existing = activeMatches.get(existingMatchId);
      if (existing && existing.status !== 'finished') {
        socket.emit('survival:error', { message: 'Ya estás en una partida activa' });
        return;
      }
      // Match no longer active — clear stale entry so the player can queue again
      playerMatches.delete(user.userId);
    }

    const category = normalizeCategory(data?.category);

    // Try to join an existing filling room
    for (const match of activeMatches.values()) {
      if (
        match.status === 'filling' &&
        match.category === category &&
        match.players.length < MAX_PLAYERS
      ) {
        match.players.push({
          userId: user.userId,
          username: user.username,
          socketId: socket.id,
          lives: STARTING_LIVES,
          streak: 0,
          livesEarned: 0,
          score: 0,
          correctCount: 0,
          answers: [],
          eliminated: false,
          eliminatedRound: null,
          finalRank: null,
        });
        playerMatches.set(user.userId, match.id);
        socket.join(match.id);

        // Sync the joining player to the current filling state before broadcasting
        const fillTimeRemaining = Math.max(
          0,
          Math.round((FILL_WINDOW_MS - (Date.now() - match.fillStartedAt)) / 1000)
        );
        socket.emit('survival:matched', {
          matchId: match.id,
          category: match.category,
          fillTimeRemaining,
          maxPlayers: MAX_PLAYERS,
          players: match.players.map((p) => ({
            userId: p.userId,
            username: p.username,
            lives: p.lives,
          })),
        });

        io.to(match.id).emit('survival:player-joined', {
          player: { userId: user.userId, username: user.username, lives: STARTING_LIVES },
          totalPlayers: match.players.length,
          maxPlayers: MAX_PLAYERS,
        });

        if (match.players.length >= MAX_PLAYERS) {
          if (match.fillTimerId) {
            clearTimeout(match.fillTimerId);
            match.fillTimerId = undefined;
          }
          await startCountdown(io, match);
        }
        return;
      }
    }

    // Add to pending queue
    const existingIdx = pendingQueue.findIndex((p) => p.userId === user.userId);
    if (existingIdx >= 0) pendingQueue.splice(existingIdx, 1);

    pendingQueue.push({ userId: user.userId, username: user.username, socketId: socket.id, category });
    socket.emit('survival:queued', { category });

    const compatible = pendingQueue.filter((p) => p.category === category);
    if (compatible.length >= MIN_PLAYERS) {
      const group = compatible.slice(0, MAX_PLAYERS);
      for (const p of group) {
        const idx = pendingQueue.findIndex((pp) => pp.userId === p.userId);
        if (idx >= 0) pendingQueue.splice(idx, 1);
      }
      await createMatch(io, group, category);
    }
  });

  socket.on('survival:dequeue', () => {
    const queueIdx = pendingQueue.findIndex((p) => p.userId === user.userId);
    if (queueIdx >= 0) {
      pendingQueue.splice(queueIdx, 1);
      socket.emit('survival:dequeued');
    }

    const matchId = playerMatches.get(user.userId);
    if (!matchId) return;
    const match = activeMatches.get(matchId);
    if (!match || match.status !== 'filling') return;

    const playerIdx = match.players.findIndex((p) => p.userId === user.userId);
    if (playerIdx < 0) return;

    match.players.splice(playerIdx, 1);
    playerMatches.delete(user.userId);
    socket.leave(matchId);

    io.to(matchId).emit('survival:player-left', {
      userId: user.userId,
      totalPlayers: match.players.length,
    });

    if (match.players.length < MIN_PLAYERS) {
      if (match.fillTimerId) {
        clearTimeout(match.fillTimerId);
        match.fillTimerId = undefined;
      }
      io.to(matchId).emit('survival:cancelled', { reason: 'not_enough_players' });
      cleanupMatch(matchId);
    }
  });

  socket.on(
    'survival:answer',
    async (data: {
      questionId: string;
      answer: string;
      timeRemaining: number;
      coordinates?: { lat: number; lng: number };
    }) => {
      if (isRateLimited(socket.id, 'survival:answer', 120)) return;

      const matchId = playerMatches.get(user.userId);
      if (!matchId) return;
      const match = activeMatches.get(matchId);
      if (!match || match.status !== 'playing') return;

      const player = match.players.find((p) => p.userId === user.userId);
      if (!player || player.eliminated) return;

      const round = match.currentRound;
      const question = match.questions[round - 1];
      if (!question || data.questionId !== question.id) return;
      // Si hay validación en vuelo para esta ronda, esperar
      if (player.pendingRound === round) return;

      // Si ya respondió, permitir cambio solo si la ronda aún no se resuelve
      if (player.answers.length >= round) {
        if (match.resolvingRound === round) return;
        if (getActivePlayers(match).every((p) => p.answers.length >= round)) return;
        // Score en survival se computa en resolveRound, no incrementalmente — solo sacar la respuesta anterior
        player.answers.splice(round - 1, 1);
      }

      const lockKey = `${matchId}-${user.userId}-${round}`;
      if (processingAnswers.has(lockKey)) return;
      processingAnswers.add(lockKey);

      try {
        player.pendingRound = round;

        let result: AnswerResult;
        try {
          result = await validateAnswer(data.questionId, data.answer, data.timeRemaining, data.coordinates);
        } catch {
          player.pendingRound = undefined;
          return;
        }

        if (match.status !== 'playing' || match.currentRound !== round || player.answers.length >= round) {
          player.pendingRound = undefined;
          return;
        }

        player.answers.push(result);
        player.pendingRound = undefined;

        io.to(matchId).emit('survival:player-answered', { userId: user.userId, round });

        const allAnswered = getActivePlayers(match).every((p) => p.answers.length >= round);
        if (allAnswered) resolveRound(io, match, round);
      } finally {
        processingAnswers.delete(lockKey);
      }
    }
  );

  socket.on('survival:resume', () => {
    const matchId = playerMatches.get(user.userId);
    if (!matchId) return;
    const match = activeMatches.get(matchId);
    if (!match || match.status === 'finished') {
      playerMatches.delete(user.userId);
      return;
    }

    const timer = match.disconnectTimers.get(user.userId);
    if (timer) {
      clearTimeout(timer);
      match.disconnectTimers.delete(user.userId);
    }

    const player = match.players.find((p) => p.userId === user.userId);
    if (player) player.socketId = socket.id;
    socket.join(matchId);

    socket.to(matchId).emit('survival:player-reconnected', { userId: user.userId });

    socket.emit('survival:state', {
      matchId,
      status: match.status,
      round: match.currentRound,
      difficulty: getDifficultyForRound(match.currentRound),
      timeLimit: TIME_PER_DIFFICULTY[getDifficultyForRound(match.currentRound)],
      players: match.players.map((p) => ({
        userId: p.userId,
        username: p.username,
        lives: p.lives,
        streak: p.streak,
        score: p.score,
        eliminated: p.eliminated,
        eliminatedRound: p.eliminatedRound,
      })),
      currentQuestion: match.status === 'playing' ? match.questions[match.currentRound - 1] : null,
    });
  });

  socket.on('disconnect', () => {
    const queueIdx = pendingQueue.findIndex((p) => p.userId === user.userId);
    if (queueIdx >= 0) pendingQueue.splice(queueIdx, 1);

    const matchId = playerMatches.get(user.userId);
    if (!matchId) return;
    const match = activeMatches.get(matchId);
    if (!match || match.status === 'finished') return;

    const player = match.players.find((p) => p.userId === user.userId);
    if (!player || player.socketId !== socket.id) return;

    if (match.status === 'filling') {
      const idx = match.players.findIndex((p) => p.userId === user.userId);
      if (idx >= 0) match.players.splice(idx, 1);
      playerMatches.delete(user.userId);

      io.to(matchId).emit('survival:player-left', { userId: user.userId, totalPlayers: match.players.length });

      if (match.players.length < MIN_PLAYERS) {
        if (match.fillTimerId) {
          clearTimeout(match.fillTimerId);
          match.fillTimerId = undefined;
        }
        io.to(matchId).emit('survival:cancelled', { reason: 'not_enough_players' });
        cleanupMatch(matchId);
      }
      return;
    }

    socket.to(matchId).emit('survival:player-disconnected', { userId: user.userId });

    const gracePeriod = setTimeout(async () => {
      match.disconnectTimers.delete(user.userId);
      const m = activeMatches.get(matchId);
      if (!m || m.status === 'finished') return;

      const p = m.players.find((pp) => pp.userId === user.userId);
      if (!p || p.eliminated) return;

      const remaining = getActivePlayers(m).filter((pp) => pp.userId !== user.userId);
      p.eliminated = true;
      p.eliminatedRound = m.currentRound;
      p.finalRank = remaining.length + 1;

      io.to(matchId).emit('survival:player-eliminated', {
        userId: user.userId,
        reason: 'disconnected',
        finalRank: p.finalRank,
      });

      if (remaining.length <= 1) {
        if (remaining.length === 1) remaining[0].finalRank = 1;
        await endGame(io, m, 'player_disconnected');
      }
    }, DISCONNECT_GRACE_MS);

    match.disconnectTimers.set(user.userId, gracePeriod);
  });
}
