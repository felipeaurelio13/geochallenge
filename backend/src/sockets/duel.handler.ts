import { Server as SocketIOServer, Socket } from 'socket.io';
import { Category, GameMode } from '@prisma/client';
import {
  getQuestionsForGame,
  validateAnswer,
  saveGameResult,
  AnswerResult,
  GameQuestion,
  getMechanicsConfigForMode,
} from '../services/game.service.js';
import { updateLeaderboardScore } from '../services/leaderboard.service.js';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import {
  createUnansweredResult,
  determineDuelWinner,
  shouldAutoCloseQuestion,
  shouldForceStartDuel,
  shouldResolveQuestion,
} from './duel.utils.js';

interface QueuedPlayer {
  userId: string;
  username: string;
  socketId: string;
  joinedAt: Date;
  category?: Category;
}

const DUEL_CATEGORIES: Category[] = ['MAP', 'FLAG', 'CAPITAL', 'SILHOUETTE', 'MIXED'];

function isCompatibleCategory(categoryA: Category, categoryB: Category): boolean {
  return categoryA === categoryB;
}

function normalizeCategory(category?: Category): Category {
  if (!category) {
    return 'MIXED';
  }

  return DUEL_CATEGORIES.includes(category) ? category : 'MIXED';
}

interface ActiveDuel {
  id: string;
  players: {
    userId: string;
    username: string;
    socketId: string;
    answers: AnswerResult[];
    score: number;
    ready: boolean;
    pendingQuestionIndex?: number;
  }[];
  questions: GameQuestion[];
  questionsData: any[]; // Full questions with answers for validation
  currentQuestionIndex: number;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  category?: Category;
  startedAt?: Date;
  questionStartedAt?: Date;
  resolvingQuestionIndex?: number;
}

// Matchmaking queue
export class MatchmakingQueue {
  private queue: QueuedPlayer[] = [];

  addPlayer(player: QueuedPlayer): void {
    // Remove if already in queue
    this.removePlayer(player.userId);
    this.queue.push({
      ...player,
      category: normalizeCategory(player.category),
    });
  }

  removePlayer(userId: string): QueuedPlayer | null {
    const index = this.queue.findIndex((p) => p.userId === userId);
    if (index !== -1) {
      return this.queue.splice(index, 1)[0];
    }
    return null;
  }

  findMatch(): [QueuedPlayer, QueuedPlayer] | null {
    if (this.queue.length < 2) return null;

    for (let i = 0; i < this.queue.length - 1; i++) {
      for (let j = i + 1; j < this.queue.length; j++) {
        const player1 = this.queue[i];
        const player2 = this.queue[j];
        const player1Category = normalizeCategory(player1.category);
        const player2Category = normalizeCategory(player2.category);

        if (!isCompatibleCategory(player1Category, player2Category)) {
          continue;
        }

        this.queue.splice(j, 1);
        this.queue.splice(i, 1);
        return [player1, player2];
      }
    }

    return null;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  isInQueue(userId: string): boolean {
    return this.queue.some((p) => p.userId === userId);
  }
}

// Active duels storage
const activeDuels = new Map<string, ActiveDuel>();

// Player to duel mapping
const playerDuels = new Map<string, string>();

// Mutex for answer processing to prevent race conditions
const processingAnswers = new Set<string>();

// Store ready-check timeout references for cleanup on disconnect
const readyTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

// Simple per-socket event rate limiter
const eventCounts = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(socketId: string, event: string, maxPerMinute: number = 30): boolean {
  const key = `${socketId}:${event}`;
  const now = Date.now();
  const entry = eventCounts.get(key);
  if (!entry || now > entry.resetAt) {
    eventCounts.set(key, { count: 1, resetAt: now + 60000 });
    return false;
  }
  entry.count++;
  return entry.count > maxPerMinute;
}

const READY_TIMEOUT_MS = 7000;

/**
 * Genera un ID único para el duelo
 */
function generateDuelId(): string {
  return `duel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Configura los handlers de duelos
 */
export function setupDuelHandlers(io: SocketIOServer, socket: Socket, queue: MatchmakingQueue) {
  const user = socket.user!;

  // Unirse a la cola de matchmaking
  socket.on('duel:queue', async (data?: { category?: Category }) => {
    if (isRateLimited(socket.id, 'duel:queue', 10)) {
      socket.emit('duel:error', { message: 'Demasiadas solicitudes, intenta más tarde' });
      return;
    }

    const selectedCategory = normalizeCategory(data?.category);

    // Verificar si ya está en un duelo
    if (playerDuels.has(user.userId)) {
      socket.emit('duel:error', { message: 'Ya estás en un duelo activo' });
      return;
    }

    // Agregar a la cola
    queue.addPlayer({
      userId: user.userId,
      username: user.username,
      socketId: socket.id,
      joinedAt: new Date(),
      category: selectedCategory,
    });

    socket.emit('duel:queued', {
      message: 'Buscando oponente...',
      queueSize: queue.getQueueSize(),
    });

    // Intentar encontrar match
    const match = queue.findMatch();
    if (match) {
      await createDuel(io, match[0], match[1], normalizeCategory(match[0].category));
    }
  });

  // Cancelar búsqueda
  socket.on('duel:cancel', () => {
    queue.removePlayer(user.userId);
    socket.emit('duel:cancelled', { message: 'Búsqueda cancelada' });
  });

  // Jugador listo para empezar
  socket.on('duel:ready', () => {
    const duelId = playerDuels.get(user.userId);
    if (!duelId) return;

    const duel = activeDuels.get(duelId);
    if (!duel || duel.status !== 'waiting') return;

    const player = duel.players.find((p) => p.userId === user.userId);
    if (player) {
      player.ready = true;

      // Si ambos están listos, iniciar countdown
      if (duel.players.every((p) => p.ready)) {
        startDuelCountdown(io, duel);
      }
    }
  });

  // Enviar respuesta
  socket.on('duel:answer', async (data: {
    questionId: string;
    answer: string;
    timeRemaining: number;
    mechanicUsage?: {
      key: 'intel5050' | 'focusTime' | 'streakShield';
      action: 'trigger';
      questionId?: string;
      roundIndex?: number;
      value?: number;
    };
    coordinates?: { lat: number; lng: number };
  }) => {
    if (isRateLimited(socket.id, 'duel:answer', 30)) {
      socket.emit('duel:error', { message: 'Demasiadas solicitudes, intenta más tarde' });
      return;
    }

    const duelId = playerDuels.get(user.userId);
    if (!duelId) return;

    const duel = activeDuels.get(duelId);
    if (!duel || duel.status !== 'playing') return;

    const player = duel.players.find((p) => p.userId === user.userId);
    if (!player) return;

    // Verificar que sea la pregunta actual
    const currentQuestion = duel.questions[duel.currentQuestionIndex];
    if (data.questionId !== currentQuestion.id) return;

    // Verificar que no haya respondido ni esté respondiendo ya esta pregunta
    if (
      player.answers.length >= duel.currentQuestionIndex + 1 ||
      player.pendingQuestionIndex === duel.currentQuestionIndex
    ) {
      return;
    }

    // Mutex lock to prevent race conditions on concurrent answer submissions
    const lockKey = `${duelId}-${user.userId}-${duel.currentQuestionIndex}`;
    if (processingAnswers.has(lockKey)) return;
    processingAnswers.add(lockKey);

    try {
      player.pendingQuestionIndex = duel.currentQuestionIndex;

      let result: AnswerResult;
      try {
        // Validar respuesta
        result = await validateAnswer(
          data.questionId,
          data.answer,
          data.timeRemaining,
          data.coordinates
        );
      } catch (error) {
        player.pendingQuestionIndex = undefined;
        console.error('Error validando respuesta en duelo:', error);
        return;
      }

      // Revalidar por si el duelo avanzó/cerró mientras validábamos
      if (
        duel.status !== 'playing' ||
        duel.currentQuestionIndex !== player.pendingQuestionIndex ||
        player.answers.length >= duel.currentQuestionIndex + 1
      ) {
        player.pendingQuestionIndex = undefined;
        return;
      }

      player.answers.push(result);
      player.score += result.points;
      player.pendingQuestionIndex = undefined;

      // Notificar a ambos jugadores que este jugador respondió
      io.to(duel.id).emit('duel:playerAnswered', {
        userId: user.userId,
        questionIndex: duel.currentQuestionIndex,
      });

      // Si ambos respondieron, mostrar resultado y pasar a siguiente pregunta
      if (
        duel.players.every((p) => p.answers.length > duel.currentQuestionIndex) &&
        shouldResolveQuestion(
          duel.status,
          duel.currentQuestionIndex,
          duel.currentQuestionIndex,
          duel.resolvingQuestionIndex
        )
      ) {
        await showQuestionResult(io, duel, duel.currentQuestionIndex);
      }
    } finally {
      processingAnswers.delete(lockKey);
    }
  });

  // Desconexión durante duelo
  socket.on('disconnect', () => {
    const duelId = playerDuels.get(user.userId);
    if (duelId) {
      // Clean up ready-check timeout for this duel
      const readyTimeout = readyTimeouts.get(duelId);
      if (readyTimeout) {
        clearTimeout(readyTimeout);
        readyTimeouts.delete(duelId);
      }

      const duel = activeDuels.get(duelId);
      if (duel && duel.status !== 'finished') {
        // El otro jugador gana por abandono
        const winner = duel.players.find((p) => p.userId !== user.userId);
        endDuel(io, duel, winner?.userId || null, 'opponent_disconnected');
      }
    }

    // Clean up rate limiter entries for this socket
    for (const key of eventCounts.keys()) {
      if (key.startsWith(`${socket.id}:`)) {
        eventCounts.delete(key);
      }
    }
  });
}

/**
 * Crea un nuevo duelo entre dos jugadores
 */
async function createDuel(
  io: SocketIOServer,
  player1: QueuedPlayer,
  player2: QueuedPlayer,
  category?: Category
) {
  const duelId = generateDuelId();

  // Obtener preguntas
  const questions = await getQuestionsForGame(category, config.game.questionsPerGame);

  // Obtener datos completos de preguntas para validación
  const questionsData = await prisma.question.findMany({
    where: { id: { in: questions.map((q) => q.id) } },
  });

  const duel: ActiveDuel = {
    id: duelId,
    players: [
      {
        userId: player1.userId,
        username: player1.username,
        socketId: player1.socketId,
        answers: [],
        score: 0,
        ready: false,
      },
      {
        userId: player2.userId,
        username: player2.username,
        socketId: player2.socketId,
        answers: [],
        score: 0,
        ready: false,
      },
    ],
    questions,
    questionsData,
    currentQuestionIndex: 0,
    status: 'waiting',
    category,
  };

  activeDuels.set(duelId, duel);
  playerDuels.set(player1.userId, duelId);
  playerDuels.set(player2.userId, duelId);

  // Unir sockets a la sala del duelo
  const socket1 = io.sockets.sockets.get(player1.socketId);
  const socket2 = io.sockets.sockets.get(player2.socketId);

  socket1?.join(duelId);
  socket2?.join(duelId);

  // Notificar a ambos jugadores
  io.to(duelId).emit('duel:matched', {
    duelId,
    opponent: null, // Se envía personalizado a cada uno
    questionsCount: questions.length,
    timePerQuestion: config.game.timePerQuestion,
    category: category || 'MIXED',
    mechanics: getMechanicsConfigForMode('duel'),
  });

  // Enviar info del oponente a cada jugador
  io.to(player1.socketId).emit('duel:opponent', {
    userId: player2.userId,
    username: player2.username,
  });

  io.to(player2.socketId).emit('duel:opponent', {
    userId: player1.userId,
    username: player1.username,
  });

  const waitingStartedAt = Date.now();
  const readyTimeout = setTimeout(() => {
    readyTimeouts.delete(duelId);
    const currentDuel = activeDuels.get(duelId);
    if (!currentDuel) {
      return;
    }

    const readyPlayersCount = currentDuel.players.filter((p) => p.ready).length;
    if (
      shouldForceStartDuel(
        currentDuel.status,
        readyPlayersCount,
        currentDuel.players.length,
        Date.now() - waitingStartedAt,
        READY_TIMEOUT_MS
      )
    ) {
      for (const player of currentDuel.players) {
        player.ready = true;
      }

      io.to(currentDuel.id).emit('duel:ready-timeout', {
        timeoutMs: READY_TIMEOUT_MS,
      });
      startDuelCountdown(io, currentDuel);
    }
  }, READY_TIMEOUT_MS);
  readyTimeouts.set(duelId, readyTimeout);
}

/**
 * Inicia la cuenta regresiva del duelo
 */
function startDuelCountdown(io: SocketIOServer, duel: ActiveDuel) {
  duel.status = 'countdown';

  io.to(duel.id).emit('duel:countdown', { seconds: 3 });

  let countdown = 3;
  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      io.to(duel.id).emit('duel:countdown', { seconds: countdown });
    } else {
      clearInterval(countdownInterval);
      startDuel(io, duel);
    }
  }, 1000);
}

/**
 * Inicia el duelo
 */
function startDuel(io: SocketIOServer, duel: ActiveDuel) {
  duel.status = 'playing';
  duel.startedAt = new Date();

  io.to(duel.id).emit('duel:start', {
    message: '¡Comienza el duelo!',
  });

  // Enviar primera pregunta
  sendQuestion(io, duel);
}

/**
 * Envía la pregunta actual a los jugadores
 */
function sendQuestion(io: SocketIOServer, duel: ActiveDuel) {
  try {
    const questionIndex = duel.currentQuestionIndex;
    const question = duel.questions[questionIndex];
    duel.questionStartedAt = new Date();

    io.to(duel.id).emit('duel:question', {
      questionIndex,
      totalQuestions: duel.questions.length,
      question,
      timeLimit: config.game.timePerQuestion,
      mechanics: getMechanicsConfigForMode('duel'),
    });

    // Timer para forzar fin de pregunta si no responden
    setTimeout(() => {
      const currentDuel = activeDuels.get(duel.id);
      if (
        currentDuel &&
        shouldAutoCloseQuestion(
          currentDuel.status,
          questionIndex,
          currentDuel.currentQuestionIndex,
          currentDuel.resolvingQuestionIndex
        )
      ) {
        // Agregar respuestas vacías para quienes no respondieron
        for (const player of currentDuel.players) {
          if (player.answers.length <= questionIndex) {
            player.pendingQuestionIndex = undefined;
            player.answers.push(createUnansweredResult(question.id));
          }
        }
        showQuestionResult(io, currentDuel, questionIndex);
      }
    }, (config.game.timePerQuestion + 2) * 1000); // +2 segundos de buffer
  } catch (error) {
    console.error(`Error sending question for duel ${duel.id}:`, error);
    io.to(duel.id).emit('duel:error', { message: 'Error al enviar pregunta' });
    // End the duel to avoid leaving it stuck
    const winnerId = null;
    endDuel(io, duel, winnerId, 'cancelled');
  }
}

/**
 * Muestra el resultado de la pregunta y avanza a la siguiente
 */
async function showQuestionResult(io: SocketIOServer, duel: ActiveDuel, questionIndex: number) {
  if (!shouldResolveQuestion(duel.status, questionIndex, duel.currentQuestionIndex, duel.resolvingQuestionIndex)) {
    return;
  }

  duel.resolvingQuestionIndex = questionIndex;

  const questionData = duel.questionsData.find(
    (q) => q.id === duel.questions[questionIndex].id
  );

  const results = duel.players.map((p) => ({
    userId: p.userId,
    username: p.username,
    answer: p.answers[questionIndex],
    totalScore: p.score,
  }));

  io.to(duel.id).emit('duel:questionResult', {
    questionIndex,
    correctAnswer: questionData?.correctAnswer,
    results,
  });

  // Esperar 3 segundos y pasar a siguiente pregunta
  setTimeout(() => {
    if (duel.currentQuestionIndex !== questionIndex || duel.status !== 'playing') {
      if (duel.resolvingQuestionIndex === questionIndex) {
        duel.resolvingQuestionIndex = undefined;
      }
      return;
    }

    duel.currentQuestionIndex++;
    if (duel.resolvingQuestionIndex === questionIndex) {
      duel.resolvingQuestionIndex = undefined;
    }

    if (duel.currentQuestionIndex >= duel.questions.length) {
      // Fin del duelo
      const winnerId = determineDuelWinner([duel.players[0], duel.players[1]]);
      endDuel(io, duel, winnerId, 'completed');
    } else {
      // Siguiente pregunta
      sendQuestion(io, duel);
    }
  }, 3000);
}

/**
 * Finaliza el duelo
 */
async function endDuel(
  io: SocketIOServer,
  duel: ActiveDuel,
  winnerId: string | null,
  reason: 'completed' | 'opponent_disconnected' | 'cancelled'
) {
  duel.status = 'finished';
  for (const player of duel.players) {
    player.pendingQuestionIndex = undefined;
  }

  const finalResults = duel.players.map((p) => ({
    userId: p.userId,
    username: p.username,
    score: p.score,
    correctCount: p.answers.filter((a) => a.isCorrect).length,
    isWinner: p.userId === winnerId,
  }));

  io.to(duel.id).emit('duel:finished', {
    reason,
    winnerId,
    isDraw: winnerId === null && reason === 'completed',
    results: finalResults,
  });

  // Guardar resultados en la base de datos usando una transacción
  try {
    await prisma.$transaction(async (tx) => {
      for (const player of duel.players) {
        const { totalScore, isHighScore } = await saveGameResult(
          player.userId,
          player.answers,
          duel.category,
          GameMode.DUEL
        );

        // Actualizar wins/losses
        await tx.user.update({
          where: { id: player.userId },
          data: {
            wins: player.userId === winnerId ? { increment: 1 } : undefined,
            losses: winnerId && player.userId !== winnerId ? { increment: 1 } : undefined,
          },
        });

        // Actualizar leaderboard
        if (isHighScore) {
          await updateLeaderboardScore(player.userId, totalScore);
        }
      }
    });
  } catch (error) {
    console.error(`Error guardando resultados del duelo ${duel.id}:`, error);
  }

  // Limpiar
  readyTimeouts.delete(duel.id);
  playerDuels.delete(duel.players[0].userId);
  playerDuels.delete(duel.players[1].userId);
  activeDuels.delete(duel.id);
}
