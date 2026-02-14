import { prisma } from '../config/database.js';
import { config } from '../config/env.js';
import { Category, Difficulty, GameMode } from '@prisma/client';
import { haversineDistance, calculateMapScore } from '../utils/haversine.js';
import { calculateScore, shuffleArray, selectRandom } from '../utils/scoring.js';

export interface GameQuestion {
  id: string;
  category: Category;
  questionText: string;
  options: string[];
  correctAnswer: string;
  difficulty?: string;
  questionData?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
}

export interface AnswerResult {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
  userAnswer: string;
  points: number;
  distance?: number; // Para preguntas de mapa
}

export interface GameSession {
  questions: GameQuestion[];
  currentIndex: number;
  answers: AnswerResult[];
  totalScore: number;
  startedAt: Date;
}

// Cache de preguntas en memoria para mejor performance
const MAP_CORRECT_DISTANCE_KM = 500;

let questionsCache: Map<string, any> = new Map();

/**
 * Obtiene preguntas para una nueva partida
 */
export async function getQuestionsForGame(
  category?: Category,
  count: number = config.game.questionsPerGame,
  excludeIds: string[] = []
): Promise<GameQuestion[]> {
  // Buscar preguntas en la base de datos
  let questions = await prisma.question.findMany({
    where: {
      ...(category && category !== Category.MIXED && { category }),
      id: { notIn: excludeIds },
    },
  });

  // Si hay categoría MIXED, mezclar de todas las categorías
  if (category === Category.MIXED || !category) {
    const categories = [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE];
    const mixedQuestions = [];
    for (const cat of categories) {
      const catQuestions = await prisma.question.findMany({
        where: {
          category: cat,
          id: { notIn: excludeIds },
        },
      });
      mixedQuestions.push(...catQuestions);
    }
    questions = mixedQuestions;
  }

  // Seleccionar aleatoriamente
  const selectedQuestions = selectRandom(questions, count);

  // Formatear para el cliente
  return selectedQuestions.map((q) => ({
    id: q.id,
    category: q.category,
    questionText: generateQuestionText(q),
    options: shuffleArray(q.options),
    correctAnswer: q.correctAnswer,
    difficulty: q.difficulty,
    questionData: q.questionData,
    imageUrl: q.imageUrl || undefined,
    latitude: q.category === Category.MAP ? q.latitude || undefined : undefined,
    longitude: q.category === Category.MAP ? q.longitude || undefined : undefined,
  }));
}

/**
 * Genera el texto de la pregunta según la categoría
 */
function generateQuestionText(question: any): string {
  switch (question.category) {
    case Category.FLAG:
      return `¿A qué país pertenece esta bandera?`;
    case Category.CAPITAL:
      if (Math.random() > 0.5) {
        return `¿Cuál es la capital de ${question.questionData}?`;
      } else {
        return `${question.correctAnswer} es la capital de...`;
      }
    case Category.MAP:
      return `¿Dónde se encuentra ${question.questionData}?`;
    case Category.SILHOUETTE:
      return `¿Qué país representa esta silueta?`;
    default:
      return question.questionData;
  }
}

/**
 * Valida una respuesta y calcula puntos
 */
export async function validateAnswer(
  questionId: string,
  userAnswer: string,
  timeRemaining: number,
  userCoords?: { lat: number; lng: number }
): Promise<AnswerResult> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    throw new Error('Pregunta no encontrada');
  }

  let isCorrect = false;
  let points = 0;
  let distance: number | undefined;

  if (question.category === Category.MAP && userCoords && question.latitude && question.longitude) {
    // Para preguntas de mapa, calcular distancia
    distance = haversineDistance(
      userCoords.lat,
      userCoords.lng,
      question.latitude,
      question.longitude
    );
    points = calculateMapScore(distance);
    isCorrect = distance < MAP_CORRECT_DISTANCE_KM; // Consistente con el umbral de acierto visual
  } else {
    // Para preguntas de opción múltiple
    isCorrect = userAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
    points = calculateScore(isCorrect, timeRemaining);
  }

  return {
    questionId,
    isCorrect,
    correctAnswer: question.correctAnswer,
    userAnswer,
    points,
    distance,
  };
}

/**
 * Guarda el resultado de una partida
 */
export async function saveGameResult(
  userId: string,
  answers: AnswerResult[],
  category?: Category,
  gameMode: GameMode = GameMode.SINGLE
): Promise<{ gameId: string; totalScore: number; isHighScore: boolean }> {
  const totalScore = answers.reduce((sum, a) => sum + a.points, 0);
  const correctCount = answers.filter((a) => a.isCorrect).length;

  // Crear resultado de partida
  const gameResult = await prisma.gameResult.create({
    data: {
      userId,
      score: totalScore,
      correctCount,
      totalQuestions: answers.length,
      category,
      gameMode,
      details: answers as any,
    },
  });

  // Actualizar estadísticas del usuario
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { highScore: true, gamesPlayed: true },
  });

  const isHighScore = totalScore > (user?.highScore || 0);

  await prisma.user.update({
    where: { id: userId },
    data: {
      gamesPlayed: { increment: 1 },
      ...(isHighScore && { highScore: totalScore }),
    },
  });

  return {
    gameId: gameResult.id,
    totalScore,
    isHighScore,
  };
}

/**
 * Obtiene el historial de partidas de un usuario
 */
export async function getUserGameHistory(
  userId: string,
  limit: number = 10
): Promise<any[]> {
  return prisma.gameResult.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      score: true,
      correctCount: true,
      totalQuestions: true,
      category: true,
      gameMode: true,
      createdAt: true,
    },
  });
}
