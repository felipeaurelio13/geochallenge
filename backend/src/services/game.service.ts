import { prisma } from '../config/database.js';
import { config } from '../config/env.js';
import { Category, Difficulty, GameMode, Prisma } from '@prisma/client';
import { haversineDistance } from '../utils/haversine.js';
import { calculateScore, calculateMapScore, calculateTimeBonus, shuffleArray, selectRandom } from '../utils/scoring.js';

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
  continent?: string;
  subregion?: string;
  isInsular?: boolean;
  isLandlocked?: boolean;
  populationTier?: string;
  areaTier?: string;
}

export interface QuestionFilters {
  continent?: string;
  isInsular?: boolean;
  isLandlocked?: boolean;
  difficulty?: Difficulty;
}

function buildFilterWhere(filters?: QuestionFilters): object {
  if (!filters) return {};
  return {
    ...(filters.continent && { continent: filters.continent }),
    ...(filters.isInsular !== undefined && { isInsular: filters.isInsular }),
    ...(filters.isLandlocked !== undefined && { isLandlocked: filters.isLandlocked }),
    ...(filters.difficulty && { difficulty: filters.difficulty }),
  };
}

export type GameMechanicKey = 'intel5050' | 'focusTime' | 'streakShield';

export interface MechanicsConfig {
  enabled: boolean;
  allowed: GameMechanicKey[];
  limits: Partial<Record<GameMechanicKey, number>>;
}

export interface AnswerResult {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
  userAnswer: string;
  points: number;
  basePoints?: number;
  timeBonus?: number;
  comboBonus?: number;
  accuracyBonus?: number;
  distance?: number; // Para preguntas de mapa
  timeRemaining: number;
}

export interface GameSession {
  questions: GameQuestion[];
  currentIndex: number;
  answers: AnswerResult[];
  totalScore: number;
  startedAt: Date;
}

export type SoloGameType = 'single' | 'streak' | 'flash';
type SoloModeScoringStrategy = 'simple_1_0' | 'progressive_combo';

/**
 * Flash mode: combo multiplier tiers for consecutive correct answers.
 * Resets to 1 on wrong answer. Capped at x10.
 */
const FLASH_COMBO_TIERS = [1, 1, 2, 2, 3, 3, 5, 5, 8, 8, 10];
export function getFlashMultiplier(combo: number): number {
  const index = Math.max(0, Math.floor(combo));
  return FLASH_COMBO_TIERS[Math.min(index, FLASH_COMBO_TIERS.length - 1)];
}
const FLASH_BASE_POINTS = 10;

interface SoloModeScoringContext {
  previousStreak?: number;
  combo?: number;
}

function buildMechanicsLimits(): Partial<Record<GameMechanicKey, number>> {
  const mechanicsConfig = config.game.mechanics;
  return {
    intel5050: mechanicsConfig?.limits?.intel5050 ?? 1,
    focusTime: mechanicsConfig?.limits?.focusTime ?? 1,
    streakShield: mechanicsConfig?.limits?.streakShield ?? 1,
  };
}

export function getMechanicsConfigForMode(
  gameMode: SoloGameType | 'duel' | 'challenge'
): MechanicsConfig {
  const mechanicsConfig = config.game.mechanics;
  if (!mechanicsConfig) {
    return { enabled: false, allowed: [], limits: {} };
  }

  if (gameMode === 'streak') {
    return { enabled: false, allowed: [], limits: {} };
  }

  const modeFlagKey: 'single' | 'flash' | 'duel' | 'challenge' = gameMode;
  const modeEnabled = mechanicsConfig[modeFlagKey];
  if (!modeEnabled) {
    return { enabled: false, allowed: [], limits: {} };
  }

  if (gameMode === 'flash') {
    return {
      enabled: true,
      allowed: ['intel5050', 'focusTime'],
      limits: {
        intel5050: mechanicsConfig.limits.intel5050,
        focusTime: mechanicsConfig.limits.focusTime,
      },
    };
  }

  if (gameMode === 'duel' || gameMode === 'challenge') {
    return {
      enabled: true,
      allowed: ['intel5050', 'focusTime'],
      limits: {
        intel5050: mechanicsConfig.limits.intel5050,
        focusTime: mechanicsConfig.limits.focusTime,
      },
    };
  }

  return {
    enabled: true,
    allowed: ['intel5050', 'focusTime'],
    limits: buildMechanicsLimits(),
  };
}

// Cache de preguntas en memoria para mejor performance
const MAP_CORRECT_DISTANCE_KM = 500;
const FLASH_TOTAL_QUESTIONS = 60;
const FLASH_DURATION_SECONDS = 60;
const FLASH_OPTIONS_COUNT = 2;
const STREAK_BATCH_SIZE = 3;
const STREAK_UNIQUE_FETCH_FACTOR = 4;
const STREAK_UNIQUE_MAX_ATTEMPTS = 3;

let questionsCache: Map<string, any> = new Map();

/**
 * Obtiene preguntas para una nueva partida
 */
export async function getQuestionsForGame(
  category?: Category,
  count: number = config.game.questionsPerGame,
  excludeIds: string[] = [],
  filters?: QuestionFilters
): Promise<GameQuestion[]> {
  const baseWhere = { isAvailable: true, id: { notIn: excludeIds }, ...buildFilterWhere(filters) };

  // Buscar preguntas en la base de datos
  let questions = await prisma.question.findMany({
    where: {
      ...baseWhere,
      ...(category && category !== Category.MIXED && { category }),
    },
  });

  // Si hay categoría MIXED, obtener de todas las categorías en una sola query
  if (category === Category.MIXED || !category) {
    questions = await prisma.question.findMany({
      where: {
        ...baseWhere,
        category: { in: [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE, Category.MONUMENT] },
      },
    });
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
    continent: q.continent || undefined,
    subregion: q.subregion || undefined,
    isInsular: q.isInsular ?? undefined,
    isLandlocked: q.isLandlocked ?? undefined,
    populationTier: q.populationTier || undefined,
    areaTier: q.areaTier || undefined,
  }));
}

export async function getAvailableQuestionsCount(
  category?: Category,
  filters?: QuestionFilters
): Promise<number> {
  const where = {
    isAvailable: true,
    ...buildFilterWhere(filters),
    ...(category && category !== Category.MIXED && { category }),
    ...((category === Category.MIXED || !category) && {
      category: { in: [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE, Category.MONUMENT] },
    }),
  };

  return prisma.question.count({ where });
}

/**
 * Flash mode: 60 preguntas rápidas, 2 opciones por pregunta.
 * MAP no es compatible (requiere mapa interactivo), hace fallback a FLAG + SILHOUETTE.
 */
export async function getQuestionsForFlashGame(category?: Category, filters?: QuestionFilters): Promise<GameQuestion[]> {
  const visualCategories = [Category.FLAG, Category.SILHOUETTE, Category.MONUMENT];
  const flashCategories =
    category && category !== Category.MIXED && category !== Category.MAP
      ? [category]
      : visualCategories;

  const questions = await prisma.question.findMany({
    where: {
      category: { in: flashCategories },
      isAvailable: true,
      ...buildFilterWhere(filters),
    },
  });

  if (questions.length === 0) {
    return [];
  }

  const selected = selectRandom(questions, Math.min(FLASH_TOTAL_QUESTIONS, questions.length));

  return selected.map((q) => {
    const shuffled = shuffleArray(q.options);
    const correct = q.correctAnswer;
    const correctIdx = shuffled.findIndex(
      (opt) => opt.toLowerCase().trim() === correct.toLowerCase().trim()
    );
    // Keep the correct option + one distractor (first that isn't the correct one).
    const correctOption = correctIdx >= 0 ? shuffled[correctIdx] : correct;
    const distractor = shuffled.find((opt) => opt !== correctOption) ?? shuffled[0];
    const pair = shuffleArray([correctOption, distractor]).slice(0, FLASH_OPTIONS_COUNT);

    return {
      id: q.id,
      category: q.category,
      questionText: generateQuestionText(q),
      options: pair,
      correctAnswer: correct,
      difficulty: q.difficulty,
      questionData: q.questionData,
      imageUrl: q.imageUrl || undefined,
      continent: q.continent || undefined,
      subregion: q.subregion || undefined,
      isInsular: q.isInsular ?? undefined,
      isLandlocked: q.isLandlocked ?? undefined,
    };
  });
}

export function getFlashDurationSeconds(): number {
  return FLASH_DURATION_SECONDS;
}

/**
 * Resuelve el tamaño de lote para modo racha con un valor pequeño y estable.
 */
export function getStreakBatchSize(requestedCount?: number): number {
  if (!requestedCount || Number.isNaN(requestedCount)) {
    return STREAK_BATCH_SIZE;
  }

  return Math.max(1, Math.min(STREAK_BATCH_SIZE, requestedCount));
}

/**
 * Obtiene un lote reducido de preguntas para modo racha.
 * Reutiliza la selección estándar y permite excluir IDs recién usados.
 */
export async function getQuestionsForStreakGame(
  category?: Category,
  excludeIds: string[] = [],
  requestedCount?: number,
  excludeQuestionKeys: string[] = [],
  filters?: QuestionFilters
): Promise<GameQuestion[]> {
  const batchSize = getStreakBatchSize(requestedCount);

  if (!config.game.enableStreakUniqueQuestions) {
    return getQuestionsForGame(category, batchSize, excludeIds, filters);
  }

  const seenQuestionKeys = new Set(excludeQuestionKeys.map((key) => normalizeUniquenessPart(key)));
  const triedIds = new Set(excludeIds);
  const selectedQuestions: GameQuestion[] = [];

  for (let attempt = 0; attempt < STREAK_UNIQUE_MAX_ATTEMPTS; attempt += 1) {
    const remainingCount = batchSize - selectedQuestions.length;
    if (remainingCount <= 0) {
      break;
    }

    const candidateQuestions = await getQuestionsForGame(
      category,
      remainingCount * STREAK_UNIQUE_FETCH_FACTOR,
      Array.from(triedIds),
      filters
    );

    if (candidateQuestions.length === 0) {
      break;
    }

    for (const candidate of candidateQuestions) {
      triedIds.add(candidate.id);

      const candidateKey = buildQuestionUniquenessKey(candidate);
      if (seenQuestionKeys.has(candidateKey)) {
        continue;
      }

      seenQuestionKeys.add(candidateKey);
      selectedQuestions.push(candidate);

      if (selectedQuestions.length >= batchSize) {
        break;
      }
    }
  }

  return selectedQuestions;
}

function normalizeUniquenessPart(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase();
}

export function buildQuestionUniquenessKey(question: Pick<GameQuestion, 'category' | 'imageUrl' | 'questionData' | 'correctAnswer'>): string {
  // Para MONUMENT, ancla la unicidad al slug del monumento (no a la variante de prompt),
  // así el modo racha no repite el mismo monumento con preguntas distintas.
  if (question.category === Category.MONUMENT) {
    const slug = extractMonumentSlug(question.questionData);
    return [
      normalizeUniquenessPart(question.category),
      normalizeUniquenessPart(slug || question.imageUrl),
    ].join('|');
  }

  return [
    normalizeUniquenessPart(question.category),
    normalizeUniquenessPart(question.imageUrl),
    normalizeUniquenessPart(question.questionData),
    normalizeUniquenessPart(question.correctAnswer),
  ].join('|');
}

function extractMonumentSlug(questionData: string | undefined | null): string | null {
  if (!questionData) return null;
  try {
    const parsed = JSON.parse(questionData) as { slug?: string };
    return parsed.slug ?? null;
  } catch {
    return null;
  }
}

/**
 * Genera el texto de la pregunta según la categoría
 */
export function generateQuestionText(question: any): string {
  switch (question.category) {
    case Category.FLAG:
      return `¿A qué país pertenece esta bandera?`;
    case Category.CAPITAL:
      // questionData = país, options = capitales, correctAnswer = capital.
      // Mantenemos un único phrasing consistente con el shape sembrado.
      return `¿Cuál es la capital de ${question.questionData}?`;
    case Category.MAP:
      return `¿Dónde se encuentra ${question.questionData}?`;
    case Category.SILHOUETTE:
      return `¿Qué país representa esta silueta?`;
    case Category.MONUMENT: {
      try {
        const parsed = JSON.parse(question.questionData) as { variant?: 'identify' | 'country' };
        if (parsed.variant === 'country') {
          return '¿En qué país está este monumento?';
        }
      } catch {
        // sigue al default identify
      }
      return '¿Qué monumento es este?';
    }
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
  let basePoints: number | undefined;
  let timeBonus: number | undefined;
  let accuracyBonus: number | undefined;

  if (question.category === Category.MAP && userCoords && question.latitude && question.longitude) {
    // Para preguntas de mapa, calcular distancia
    distance = haversineDistance(
      userCoords.lat,
      userCoords.lng,
      question.latitude,
      question.longitude
    );
    points = calculateMapScore(distance, timeRemaining);
    isCorrect = distance < MAP_CORRECT_DISTANCE_KM; // Consistente con el umbral de acierto visual
    if (points > 0) {
      const clampedDistance = Math.min(2000, Math.max(0, distance));
      const accuracyFactor = 1 - clampedDistance / 2000;
      const rawTimeBonus = calculateTimeBonus(timeRemaining);

      accuracyBonus = Math.round(config.game.basePoints * accuracyFactor);
      timeBonus = Math.round(rawTimeBonus * accuracyFactor);
      basePoints = 0;
    } else {
      basePoints = 0;
      timeBonus = 0;
      accuracyBonus = 0;
    }
  } else {
    // Para preguntas de opción múltiple
    isCorrect = userAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
    points = calculateScore(isCorrect, timeRemaining);
    basePoints = isCorrect ? config.game.basePoints : 0;
    timeBonus = isCorrect ? calculateTimeBonus(timeRemaining) : 0;
  }

  return {
    questionId,
    isCorrect,
    correctAnswer: question.correctAnswer,
    userAnswer,
    points,
    basePoints,
    timeBonus,
    accuracyBonus,
    distance,
    timeRemaining: Math.max(0, timeRemaining),
  };
}

/**
 * Aplica estrategia de puntaje por tipo de partida para modos individuales.
 * - single: conserva scoring existente
 * - streak: 1 punto por acierto, 0 por error
 *
 * Si el feature flag está deshabilitado, hace fallback a scoring single.
 */
export function applySoloModeScoringStrategy(
  answerResult: AnswerResult,
  gameType: SoloGameType = 'single',
  scoringContext: SoloModeScoringContext = {}
): AnswerResult {
  if (gameType === 'flash') {
    const combo = Math.max(0, Math.floor(scoringContext.combo ?? 0));
    const multiplier = getFlashMultiplier(combo);
    return {
      ...answerResult,
      points: answerResult.isCorrect ? FLASH_BASE_POINTS * multiplier : 0,
      basePoints: answerResult.isCorrect ? FLASH_BASE_POINTS : 0,
      comboBonus: answerResult.isCorrect ? FLASH_BASE_POINTS * (multiplier - 1) : 0,
      timeBonus: 0,
      accuracyBonus: undefined,
    };
  }

  if (gameType !== 'streak' || !config.game.enableStreakSimpleScoring) {
    return answerResult;
  }

  const strategy = config.game.soloModeScoringStrategy as SoloModeScoringStrategy;
  if (strategy === 'progressive_combo') {
    const safePreviousStreak = Math.max(0, Math.floor(scoringContext.previousStreak ?? 0));
    return {
      ...answerResult,
      points: answerResult.isCorrect ? safePreviousStreak + 1 : 0,
    };
  }

  return {
    ...answerResult,
    points: answerResult.isCorrect ? 1 : 0,
    basePoints: 0,
    timeBonus: 0,
    comboBonus: answerResult.isCorrect ? 1 : 0,
    accuracyBonus: undefined,
  };
}

/**
 * Wrapper aditivo sobre validateAnswer para soportar estrategias por modo
 * sin alterar semántica existente en single/duel/challenge.
 */
export async function validateAnswerByGameType(
  questionId: string,
  userAnswer: string,
  timeRemaining: number,
  userCoords?: { lat: number; lng: number },
  gameType: SoloGameType = 'single',
  scoringContext?: SoloModeScoringContext
): Promise<AnswerResult> {
  const baseResult = await validateAnswer(questionId, userAnswer, timeRemaining, userCoords);
  return applySoloModeScoringStrategy(baseResult, gameType, scoringContext);
}

/**
 * Guarda el resultado de una partida
 */
export async function saveGameResult(
  userId: string,
  answers: AnswerResult[],
  category?: Category,
  gameMode: GameMode = GameMode.SINGLE,
  txClient?: Prisma.TransactionClient
): Promise<{ gameId: string; totalScore: number; isHighScore: boolean }> {
  const totalScore = answers.reduce((sum, a) => sum + a.points, 0);
  const correctCount = answers.filter((a) => a.isCorrect).length;

  const save = async (db: Prisma.TransactionClient) => {
    const gameResult = await db.gameResult.create({
      data: {
        userId,
        score: totalScore,
        correctCount,
        totalQuestions: answers.length,
        category,
        gameMode,
        details: answers as unknown as Prisma.InputJsonValue,
      },
    });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { highScore: true, gamesPlayed: true },
    });

    const isHighScore = totalScore > (user?.highScore || 0);

    await db.user.update({
      where: { id: userId },
      data: {
        gamesPlayed: { increment: 1 },
        ...(isHighScore && { highScore: totalScore }),
      },
    });

    return { gameId: gameResult.id, totalScore, isHighScore };
  };

  if (txClient) {
    return save(txClient);
  }
  return prisma.$transaction(save);
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

type DuelPeriod = 'week' | 'month' | 'year' | 'all';

function getPeriodStart(period: DuelPeriod): Date | undefined {
  if (period === 'all') return undefined;
  const now = new Date();
  if (period === 'week') return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'year') return new Date(now.getFullYear(), 0, 1);
}

function buildDuelMatchWhere(userId: string, period: DuelPeriod) {
  const from = getPeriodStart(period);
  const dateFilter = from ? { gte: from } : undefined;
  return {
    OR: [{ player1Id: userId }, { player2Id: userId }],
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };
}

export interface DuelMatchRecord {
  id: string;
  opponentId: string;
  opponentUsername: string;
  result: 'win' | 'loss' | 'draw';
  myScore: number;
  opponentScore: number;
  category: string | null;
  createdAt: Date;
}

export interface DuelStats {
  wins: number;
  draws: number;
  losses: number;
  total: number;
}

/**
 * Historial de duelos del usuario, paginado, filtrado por período
 */
export async function getDuelMatchHistory(
  userId: string,
  period: DuelPeriod = 'all',
  page: number = 1,
  pageSize: number = 20
): Promise<{ matches: DuelMatchRecord[]; total: number }> {
  const where = buildDuelMatchWhere(userId, period);
  const [total, rows] = await Promise.all([
    prisma.duelMatch.count({ where }),
    prisma.duelMatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        player1: { select: { id: true, username: true } },
        player2: { select: { id: true, username: true } },
      },
    }),
  ]);

  const matches: DuelMatchRecord[] = rows.map((m) => {
    const isP1 = m.player1Id === userId;
    const opponent = isP1 ? m.player2 : m.player1;
    const myScore = isP1 ? m.player1Score : m.player2Score;
    const opponentScore = isP1 ? m.player2Score : m.player1Score;
    const result: 'win' | 'loss' | 'draw' =
      m.winnerId === null ? 'draw' : m.winnerId === userId ? 'win' : 'loss';
    return {
      id: m.id,
      opponentId: opponent.id,
      opponentUsername: opponent.username,
      result,
      myScore,
      opponentScore,
      category: m.category,
      createdAt: m.createdAt,
    };
  });

  return { matches, total };
}

/**
 * Estadísticas W/D/L del usuario por período (week, month, year, all)
 */
export async function getDuelMatchStats(userId: string): Promise<{
  week: DuelStats;
  month: DuelStats;
  year: DuelStats;
  all: DuelStats;
}> {
  const periods: DuelPeriod[] = ['week', 'month', 'year', 'all'];

  const statsForPeriod = async (period: DuelPeriod): Promise<DuelStats> => {
    const where = buildDuelMatchWhere(userId, period);
    const matches = await prisma.duelMatch.findMany({
      where,
      select: { winnerId: true },
    });
    let wins = 0, draws = 0, losses = 0;
    for (const m of matches) {
      if (m.winnerId === null) draws++;
      else if (m.winnerId === userId) wins++;
      else losses++;
    }
    return { wins, draws, losses, total: matches.length };
  };

  const [week, month, year, all] = await Promise.all(periods.map(statsForPeriod));
  return { week, month, year, all };
}

/**
 * Lista de oponentes con los que el usuario ha jugado duelos.
 * Filtrado por nombre y conteo se hacen en la base — solo devuelve usuarios
 * que efectivamente jugaron contra `userId`.
 */
export async function getDuelOpponents(
  userId: string,
  search?: string
): Promise<{ id: string; username: string; totalMatches: number }[]> {
  const trimmed = search?.trim();
  if (trimmed && trimmed.length > 50) return [];
  const usernameFilter = trimmed
    ? { contains: trimmed, mode: 'insensitive' as const }
    : undefined;

  const opponents = await prisma.user.findMany({
    where: {
      id: { not: userId },
      ...(usernameFilter ? { username: usernameFilter } : {}),
      OR: [
        { duelMatchesAsP1: { some: { player2Id: userId } } },
        { duelMatchesAsP2: { some: { player1Id: userId } } },
      ],
    },
    select: {
      id: true,
      username: true,
      _count: {
        select: {
          duelMatchesAsP1: { where: { player2Id: userId } },
          duelMatchesAsP2: { where: { player1Id: userId } },
        },
      },
    },
    take: 100,
  });

  return opponents
    .map((u) => ({
      id: u.id,
      username: u.username,
      totalMatches: u._count.duelMatchesAsP1 + u._count.duelMatchesAsP2,
    }))
    .sort((a, b) => b.totalMatches - a.totalMatches);
}

/**
 * Estadísticas head-to-head entre dos usuarios
 */
export async function getDuelHeadToHead(
  userId: string,
  opponentId: string
): Promise<{
  opponent: { id: string; username: string };
  periods: { week: DuelStats; month: DuelStats; year: DuelStats; all: DuelStats };
  recentMatches: DuelMatchRecord[];
} | null> {
  const opponent = await prisma.user.findUnique({
    where: { id: opponentId },
    select: { id: true, username: true },
  });
  if (!opponent) return null;

  const h2hWhere = (period: DuelPeriod) => {
    const from = getPeriodStart(period);
    const dateFilter = from ? { createdAt: { gte: from } } : {};
    return {
      OR: [
        { player1Id: userId, player2Id: opponentId },
        { player1Id: opponentId, player2Id: userId },
      ],
      ...dateFilter,
    };
  };

  const statsForPeriod = async (period: DuelPeriod): Promise<DuelStats> => {
    const matches = await prisma.duelMatch.findMany({
      where: h2hWhere(period),
      select: { winnerId: true },
    });
    let wins = 0, draws = 0, losses = 0;
    for (const m of matches) {
      if (m.winnerId === null) draws++;
      else if (m.winnerId === userId) wins++;
      else losses++;
    }
    return { wins, draws, losses, total: matches.length };
  };

  const [week, month, year, all, recentRows] = await Promise.all([
    statsForPeriod('week'),
    statsForPeriod('month'),
    statsForPeriod('year'),
    statsForPeriod('all'),
    prisma.duelMatch.findMany({
      where: h2hWhere('all'),
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        player1: { select: { id: true, username: true } },
        player2: { select: { id: true, username: true } },
      },
    }),
  ]);

  const recentMatches: DuelMatchRecord[] = recentRows.map((m) => {
    const isP1 = m.player1Id === userId;
    const opp = isP1 ? m.player2 : m.player1;
    const myScore = isP1 ? m.player1Score : m.player2Score;
    const oppScore = isP1 ? m.player2Score : m.player1Score;
    const result: 'win' | 'loss' | 'draw' =
      m.winnerId === null ? 'draw' : m.winnerId === userId ? 'win' : 'loss';
    return {
      id: m.id,
      opponentId: opp.id,
      opponentUsername: opp.username,
      result,
      myScore,
      opponentScore: oppScore,
      category: m.category,
      createdAt: m.createdAt,
    };
  });

  return { opponent, periods: { week, month, year, all }, recentMatches };
}

export interface CategoryStat {
  category: string;
  totalGames: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
  bestScore: number;
}

export async function getCategoryStats(userId: string): Promise<CategoryStat[]> {
  const rows = await prisma.gameResult.findMany({
    where: { userId, gameMode: 'SINGLE' },
    select: { category: true, correctCount: true, totalQuestions: true, score: true },
  });

  const byCategory: Record<string, { correct: number; total: number; games: number; best: number }> = {};

  for (const r of rows) {
    const key = r.category ?? 'MIXED';
    if (!byCategory[key]) byCategory[key] = { correct: 0, total: 0, games: 0, best: 0 };
    byCategory[key].correct += r.correctCount;
    byCategory[key].total += r.totalQuestions;
    byCategory[key].games += 1;
    byCategory[key].best = Math.max(byCategory[key].best, r.score);
  }

  return Object.entries(byCategory).map(([category, d]) => ({
    category,
    totalGames: d.games,
    correctCount: d.correct,
    totalQuestions: d.total,
    accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
    bestScore: d.best,
  }));
}
