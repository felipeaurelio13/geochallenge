import { Server as SocketIOServer, Socket } from 'socket.io';
import { Category, GameMode } from '@prisma/client';
import { getQuestionsForGame, validateAnswer, saveGameResult, AnswerResult, GameQuestion } from '../services/game.service.js';
import { updateLeaderboardScore } from '../services/leaderboard.service.js';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import { shouldAutoCloseQuestion } from './duel.utils.js';

interface QueuedPlayer {
  userId: string;
  username: string;
  socketId: string;
  joinedAt: Date;
  category?: Category;
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
  }[];
  questions: GameQuestion[];
  questionsData: any[]; // Full questions with answers for validation
  currentQuestionIndex: number;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  category?: Category;
  startedAt?: Date;
  questionStartedAt?: Date;
}

// Matchmaking queue
export class MatchmakingQueue {
  private queue: QueuedPlayer[] = [];

  addPlayer(player: QueuedPlayer): void {
    // Remove if already in queue
    this.removePlayer(player.userId);
    this.queue.push(player);
  }

  removePlayer(userId: string): QueuedPlayer | null {
    const index = this.queue.findIndex((p) => p.userId === userId);
    if (index !== -1) {
      return this.queue.splice(index, 1)[0];
    }
    return null;
  }

  findMatch(category?: Category): [QueuedPlayer, QueuedPlayer] | null {
    if (this.queue.length < 2) return null;

    // Simple FIFO matching - could be improved with skill-based matching
    const player1 = this.queue.shift()!;
    const player2 = this.queue.shift()!;

    return [player1, player2];
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
      category: data?.category,
    });

    socket.emit('duel:queued', {
      message: 'Buscando oponente...',
      queueSize: queue.getQueueSize(),
    });

    // Intentar encontrar match
    const match = queue.findMatch(data?.category);
    if (match) {
      await createDuel(io, match[0], match[1], data?.category);
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
  socket.on('duel:answer', async (data: { questionId: string; answer: string; timeRemaining: number; coordinates?: { lat: number; lng: number } }) => {
    const duelId = playerDuels.get(user.userId);
    if (!duelId) return;

    const duel = activeDuels.get(duelId);
    if (!duel || duel.status !== 'playing') return;

    const player = duel.players.find((p) => p.userId === user.userId);
    if (!player) return;

    // Verificar que sea la pregunta actual
    const currentQuestion = duel.questions[duel.currentQuestionIndex];
    if (data.questionId !== currentQuestion.id) return;

    // Verificar que no haya respondido ya esta pregunta
    if (player.answers.length > duel.currentQuestionIndex) return;

    // Validar respuesta
    const result = await validateAnswer(
      data.questionId,
      data.answer,
      data.timeRemaining,
      data.coordinates
    );

    player.answers.push(result);
    player.score += result.points;

    // Notificar a ambos jugadores que este jugador respondió
    io.to(duel.id).emit('duel:playerAnswered', {
      userId: user.userId,
      questionIndex: duel.currentQuestionIndex,
    });

    // Si ambos respondieron, mostrar resultado y pasar a siguiente pregunta
    if (duel.players.every((p) => p.answers.length > duel.currentQuestionIndex)) {
      await showQuestionResult(io, duel);
    }
  });

  // Desconexión durante duelo
  socket.on('disconnect', () => {
    const duelId = playerDuels.get(user.userId);
    if (duelId) {
      const duel = activeDuels.get(duelId);
      if (duel && duel.status !== 'finished') {
        // El otro jugador gana por abandono
        const winner = duel.players.find((p) => p.userId !== user.userId);
        endDuel(io, duel, winner?.userId || null, 'opponent_disconnected');
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
  const questionIndex = duel.currentQuestionIndex;
  const question = duel.questions[questionIndex];
  duel.questionStartedAt = new Date();

  io.to(duel.id).emit('duel:question', {
    questionIndex: duel.currentQuestionIndex,
    totalQuestions: duel.questions.length,
    question,
    timeLimit: config.game.timePerQuestion,
  });

  // Timer para forzar fin de pregunta si no responden
  setTimeout(() => {
    const currentDuel = activeDuels.get(duel.id);
    if (
      currentDuel &&
      shouldAutoCloseQuestion(
        currentDuel.status,
        questionIndex,
        currentDuel.currentQuestionIndex
      )
    ) {
      // Agregar respuestas vacías para quienes no respondieron
      for (const player of currentDuel.players) {
        if (player.answers.length <= questionIndex) {
          player.answers.push({
            questionId: question.id,
            isCorrect: false,
            correctAnswer: '',
            userAnswer: '',
            points: 0,
          });
        }
      }
      showQuestionResult(io, currentDuel);
    }
  }, (config.game.timePerQuestion + 2) * 1000); // +2 segundos de buffer
}

/**
 * Muestra el resultado de la pregunta y avanza a la siguiente
 */
async function showQuestionResult(io: SocketIOServer, duel: ActiveDuel) {
  const questionData = duel.questionsData.find(
    (q) => q.id === duel.questions[duel.currentQuestionIndex].id
  );

  const results = duel.players.map((p) => ({
    userId: p.userId,
    username: p.username,
    answer: p.answers[duel.currentQuestionIndex],
    totalScore: p.score,
  }));

  io.to(duel.id).emit('duel:questionResult', {
    questionIndex: duel.currentQuestionIndex,
    correctAnswer: questionData?.correctAnswer,
    results,
  });

  // Esperar 3 segundos y pasar a siguiente pregunta
  setTimeout(() => {
    duel.currentQuestionIndex++;

    if (duel.currentQuestionIndex >= duel.questions.length) {
      // Fin del duelo
      const winner = duel.players.reduce((a, b) => (a.score > b.score ? a : b));
      const winnerId = duel.players[0].score === duel.players[1].score ? null : winner.userId;
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

  // Guardar resultados en la base de datos
  for (const player of duel.players) {
    try {
      const { totalScore, isHighScore } = await saveGameResult(
        player.userId,
        player.answers,
        duel.category,
        GameMode.DUEL
      );

      // Actualizar wins/losses
      await prisma.user.update({
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
    } catch (error) {
      console.error(`Error guardando resultado del duelo para ${player.username}:`, error);
    }
  }

  // Limpiar
  playerDuels.delete(duel.players[0].userId);
  playerDuels.delete(duel.players[1].userId);
  activeDuels.delete(duel.id);
}
