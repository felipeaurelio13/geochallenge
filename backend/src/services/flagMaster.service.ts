import { Category, Difficulty } from '@prisma/client';
import { prisma } from '../config/database.js';
import { selectRandom, shuffleArray, calculateScore } from '../utils/scoring.js';
import {
  FLAG_SIMILARITY_GROUPS,
  getAllCountriesInGroups,
  getSimilarityGroupsFor,
} from '../data/flagSimilarityGroups.js';

/**
 * Flag Master: modo difícil dedicado al modo de banderas con dificultad escalada.
 *
 * Tiers (10 rondas):
 *   1-2  warmup     · sin modificador visual, opciones normales       · x1.0
 *   3-4  grayscale  · filter grayscale, opciones normales              · x1.5
 *   5-6  crop       · zoom (transform scale) sobre la imagen           · x1.5
 *   7-8  similar    · sin modificador visual, opciones del mismo grupo · x1.5
 *   9-10 combined   · grayscale + crop + opciones del mismo grupo      · x2.5
 *
 * Cada modificador testea una habilidad distinta:
 *   - grayscale → quita el cue de color (palette recognition)
 *   - crop      → fuerza reconocer composición (no la paleta)
 *   - similar   → discriminación fina contra lookalikes
 *   - combined  → todo apilado: brutal
 */

export type FlagModifier = 'none' | 'grayscale' | 'crop' | 'similar' | 'combined';

export interface FlagMasterTierConfig {
  modifier: FlagModifier;
  multiplier: number;
}

export interface FlagMasterRound {
  id: string;
  category: Category;
  questionText: string;
  options: string[];
  correctAnswer: string;
  difficulty: string;
  imageUrl?: string;
  questionData?: string;
  continent?: string;
  flagModifier: FlagModifier;
  multiplier: number;
  tier: number; // 1-5
  similarityGroupId?: string; // sólo presente cuando se usaron distractores similares
}

export interface FlagMasterStartResult {
  gameId: string;
  rounds: FlagMasterRound[];
  totalRounds: number;
  timePerQuestion: number;
}

export interface FlagMasterAnswer {
  questionId: string;
  answer: string;
  timeRemaining: number;
}

export interface FlagMasterRoundResult {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
  userAnswer: string;
  modifier: FlagModifier;
  multiplier: number;
  basePoints: number;
  timeBonus: number;
  modifierBonus: number;
  points: number;
  tier: number;
}

export interface FlagMasterFinishResult {
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
  rounds: FlagMasterRoundResult[];
}

const TOTAL_ROUNDS = 10;
const OPTIONS_PER_ROUND = 4;

/**
 * Mapa determinístico ronda (0-indexed) → tier (1-5) → config.
 * Decisión de producto: cada tier ocupa exactamente 2 rondas consecutivas.
 */
const TIER_PLAN: { tier: number; modifier: FlagModifier; multiplier: number }[] = [
  { tier: 1, modifier: 'none', multiplier: 1.0 },
  { tier: 1, modifier: 'none', multiplier: 1.0 },
  { tier: 2, modifier: 'grayscale', multiplier: 1.5 },
  { tier: 2, modifier: 'grayscale', multiplier: 1.5 },
  { tier: 3, modifier: 'crop', multiplier: 1.5 },
  { tier: 3, modifier: 'crop', multiplier: 1.5 },
  { tier: 4, modifier: 'similar', multiplier: 1.5 },
  { tier: 4, modifier: 'similar', multiplier: 1.5 },
  { tier: 5, modifier: 'combined', multiplier: 2.5 },
  { tier: 5, modifier: 'combined', multiplier: 2.5 },
];

export function getFlagMasterTierPlan(): { tier: number; modifier: FlagModifier; multiplier: number }[] {
  return TIER_PLAN.map((t) => ({ ...t }));
}

/**
 * Devuelve la configuración del tier para una ronda 0-indexed.
 * Para roundIndex fuera de rango, retorna tier 1 (defensivo).
 */
export function getTierConfigForRound(roundIndex: number): FlagMasterTierConfig {
  const safeIndex = Math.max(0, Math.min(roundIndex, TIER_PLAN.length - 1));
  const slot = TIER_PLAN[safeIndex];
  return { modifier: slot.modifier, multiplier: slot.multiplier };
}

const TIER_FOR_ROUND = (roundIndex: number) => {
  const safeIndex = Math.max(0, Math.min(roundIndex, TIER_PLAN.length - 1));
  return TIER_PLAN[safeIndex].tier;
};

const SIMILAR_TIERS: Set<FlagModifier> = new Set(['similar', 'combined']);

/**
 * Selecciona la pool de preguntas FLAG candidatas para una sesión de Flag Master.
 *
 * Estrategia:
 *   - Prefiere preguntas con difficulty=HARD.
 *   - Si no alcanzan, complementa con difficulty=MEDIUM (jamás EASY: la modalidad
 *     se llama "Master", debe sentirse difícil).
 *   - Sólo `isAvailable=true` (mismo gate que el resto del juego).
 */
async function loadFlagQuestionPool(): Promise<
  Array<{
    id: string;
    category: Category;
    options: string[];
    correctAnswer: string;
    difficulty: Difficulty;
    imageUrl: string | null;
    questionData: string;
    continent: string | null;
  }>
> {
  const hard = await prisma.question.findMany({
    where: {
      category: Category.FLAG,
      isAvailable: true,
      difficulty: Difficulty.HARD,
    },
  });

  if (hard.length >= TOTAL_ROUNDS) {
    return hard as unknown as Awaited<ReturnType<typeof loadFlagQuestionPool>>;
  }

  // Fallback: completar con MEDIUM si HARD no alcanza para 10 rondas.
  const medium = await prisma.question.findMany({
    where: {
      category: Category.FLAG,
      isAvailable: true,
      difficulty: Difficulty.MEDIUM,
    },
  });

  return [...hard, ...(medium ?? [])] as unknown as Awaited<ReturnType<typeof loadFlagQuestionPool>>;
}

interface PoolQuestion {
  id: string;
  category: Category;
  options: string[];
  correctAnswer: string;
  difficulty: Difficulty;
  imageUrl: string | null;
  questionData: string;
  continent: string | null;
}

/**
 * Construye las opciones para una ronda con distractores similares.
 *
 * Devuelve { options, groupId } si pudo encontrar al menos 3 distractores del
 * mismo grupo de similitud, o null si la pregunta no pertenece a ningún grupo
 * con suficientes pares.
 */
function buildSimilarOptions(
  correctAnswer: string,
  countriesInSomeGroup: Set<string>
): { options: string[]; groupId: string } | null {
  const groups = getSimilarityGroupsFor(correctAnswer);
  if (groups.length === 0) return null;

  for (const group of groups) {
    const candidates = group.countries.filter(
      (c) => c !== correctAnswer && countriesInSomeGroup.has(c)
    );
    if (candidates.length >= OPTIONS_PER_ROUND - 1) {
      const distractors = selectRandom(candidates, OPTIONS_PER_ROUND - 1);
      return {
        options: shuffleArray([correctAnswer, ...distractors]),
        groupId: group.id,
      };
    }
  }

  return null;
}

/**
 * Construye un set con TODOS los nombres de país presentes como respuesta
 * correcta en la pool. Útil para garantizar que los distractores similares
 * existan en el set de banderas disponibles del juego.
 */
function buildAvailableCountriesSet(pool: PoolQuestion[]): Set<string> {
  return new Set(pool.map((q) => q.correctAnswer));
}

/**
 * Asigna ronda por ronda una pregunta de la pool a cada slot del TIER_PLAN.
 *
 * Para los slots que requieren distractores similares (tiers 4 y 5), prioriza
 * preguntas cuyo país esté en algún grupo de similitud. Si no encuentra,
 * degrada elegantemente: usa la pregunta con opciones normales pero conserva
 * el modifier visual (grayscale/crop en el caso de combined).
 *
 * Retorna las rondas en orden de juego.
 */
export async function buildFlagMasterRounds(): Promise<FlagMasterRound[]> {
  const pool = await loadFlagQuestionPool();
  if (pool.length < TOTAL_ROUNDS) {
    throw new Error(
      `Flag Master requiere al menos ${TOTAL_ROUNDS} banderas en la pool (HARD+MEDIUM). Disponibles: ${pool.length}.`
    );
  }

  const availableCountries = buildAvailableCountriesSet(pool);
  const intersection = new Set<string>();
  for (const country of getAllCountriesInGroups()) {
    if (availableCountries.has(country)) intersection.add(country);
  }

  const remaining = [...pool];
  const rounds: FlagMasterRound[] = [];

  for (let i = 0; i < TOTAL_ROUNDS; i += 1) {
    const tierSlot = TIER_PLAN[i];
    const isSimilarTier = SIMILAR_TIERS.has(tierSlot.modifier);

    // Para tiers que requieren distractores similares, preferimos preguntas
    // cuyo correctAnswer esté en intersection (en algún grupo Y disponible).
    let selectedIndex = -1;
    if (isSimilarTier) {
      selectedIndex = remaining.findIndex((q) => intersection.has(q.correctAnswer));
    }
    if (selectedIndex === -1) {
      // Fallback: cualquier pregunta restante (al azar).
      selectedIndex = Math.floor(Math.random() * remaining.length);
    }

    const question = remaining[selectedIndex];
    remaining.splice(selectedIndex, 1);

    // Construir opciones según el tier.
    let options: string[];
    let similarityGroupId: string | undefined;

    if (isSimilarTier) {
      const similar = buildSimilarOptions(question.correctAnswer, intersection);
      if (similar) {
        options = similar.options;
        similarityGroupId = similar.groupId;
      } else {
        // Sin grupo válido: usar opciones del seed (4 alternativas barajadas).
        options = shuffleArray(question.options);
      }
    } else {
      options = shuffleArray(question.options);
    }

    rounds.push({
      id: question.id,
      category: Category.FLAG,
      questionText: '¿A qué país pertenece esta bandera?',
      options,
      correctAnswer: question.correctAnswer,
      difficulty: question.difficulty,
      imageUrl: question.imageUrl ?? undefined,
      questionData: question.questionData,
      continent: question.continent ?? undefined,
      flagModifier: tierSlot.modifier,
      multiplier: tierSlot.multiplier,
      tier: tierSlot.tier,
      similarityGroupId,
    });
  }

  return rounds;
}

/**
 * Recalcula el puntaje server-side para una respuesta de Flag Master.
 *
 * Fórmula:
 *   raw       = base (100) + timeBonus (0-50)   si isCorrect, sino 0
 *   modifier  = round(raw * (multiplier - 1))    bonus visible para el usuario
 *   points    = round(raw * multiplier)
 */
export function scoreFlagMasterAnswer(
  isCorrect: boolean,
  timeRemaining: number,
  multiplier: number,
  basePointsValue: number,
  maxTimeBonusValue: number,
  timePerQuestionValue: number
): { basePoints: number; timeBonus: number; modifierBonus: number; points: number } {
  if (!isCorrect) {
    return { basePoints: 0, timeBonus: 0, modifierBonus: 0, points: 0 };
  }

  const safeTime = Math.max(0, Math.min(timeRemaining, timePerQuestionValue));
  const ratio = timePerQuestionValue > 0 ? safeTime / timePerQuestionValue : 0;
  const timeBonus = Math.floor(ratio * maxTimeBonusValue);

  const raw = basePointsValue + timeBonus;
  const points = Math.round(raw * multiplier);
  const modifierBonus = points - raw;

  return {
    basePoints: basePointsValue,
    timeBonus,
    modifierBonus,
    points,
  };
}

/**
 * Util público para que el controller use el mismo path que el test.
 */
export function isSimilarTier(modifier: FlagModifier): boolean {
  return SIMILAR_TIERS.has(modifier);
}

/**
 * Expuesto para tests / debugging.
 */
export function _internals() {
  return { TIER_PLAN, TOTAL_ROUNDS, OPTIONS_PER_ROUND, FLAG_SIMILARITY_GROUPS, TIER_FOR_ROUND };
}
